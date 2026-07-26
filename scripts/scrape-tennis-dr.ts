#!/usr/bin/env node
/**
 * scrape-tennis-dr.ts
 *
 * Scraper TennisAbstract — colonne DR du tableau "Recent Results".
 * Peuple src/lib/tennis-dr/dr-cache.json (lu en runtime par lookup.ts).
 *
 * ⚠️ CONFORMITÉ : TennisAbstract interdit /jsfrags/ dans son robots.txt.
 * Ce script ne s'exécute QUE si l'env var LEGAL_OVERRIDE_CONFIRMED=1 est
 * positionnée. Vous êtes seul responsable du respect des ToS du site.
 *
 * Usage:
 *   LEGAL_OVERRIDE_CONFIRMED=1 bun run scripts/scrape-tennis-dr.ts
 *   LEGAL_OVERRIDE_CONFIRMED=1 bun run scripts/scrape-tennis-dr.ts --players="Jannik Sinner,Carlos Alcaraz"
 *   LEGAL_OVERRIDE_CONFIRMED=1 bun run scripts/scrape-tennis-dr.ts --top=300
 *   bun run scripts/scrape-tennis-dr.ts --dry-run --players="Jannik Sinner"   # parse only, no write
 *
 * Flags:
 *   --players="A,B,C"   Liste explicite de joueurs (override --top)
 *   --top=N             Top N ATP + N WTA depuis abstract-cache.json (défaut 200)
 *   --dry-run           Parse sans écrire le cache
 *   --force             Écrase intégralement le cache (sinon merge incrémental)
 *
 * Cron recommandé : quotidien 04:00 (le DR évolue match-par-match).
 *
 * Exit codes:
 *   0 — succès (cache écrit, ou dry-run)
 *   2 — LEGAL_OVERRIDE_CONFIRMED absent (refus d'exécuter)
 *   1 — erreur fatale
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cacheFilePath,
  emptyCache,
  scrapePlayerDr,
  writeCache,
  normalizeKey,
  type DrCache,
} from "../src/lib/tennis-dr/scraper";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");

function argValue(name: string): string | null {
  const found = argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
}

const playersArg = argValue("players");
const topArg = argValue("top");

// ---------------------------------------------------------------------------
// Legal guard
// ---------------------------------------------------------------------------

if (!process.env.LEGAL_OVERRIDE_CONFIRMED && !DRY_RUN) {
  console.error(
    `
=== scrape-tennis-dr : aborting ===

TennisAbstract robots.txt DISALLOWS /jsfrags/, /jsmatches/, /jsplayers/.
Ce scraper ne peut s'exécuter que si vous assumez explicitement la
responsabilité légale du scraping.

Pour bypasser ce garde-fou :
  LEGAL_OVERRIDE_CONFIRMED=1 bun run scripts/scrape-tennis-dr.ts [...]

Pour tester le parsing sans réseau ni écriture :
  bun run scripts/scrape-tennis-dr.ts --dry-run --players="Jannik Sinner"

Vous êtes seul responsable du respect des conditions d'utilisation de
tennisabstract.com. Throttle conservateur : 1 req / 1.5s.
`.trim(),
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Liste des joueurs à scraper
// ---------------------------------------------------------------------------

function resolvePlayerList(): string[] {
  if (playersArg) {
    return playersArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Sinon : top N ATP + N WTA depuis abstract-cache.json.
  // 300 depuis 2026-07-27 (avant : 200) — couvre les tableaux principaux ATP/WTA
  // + qualifs majeures pour éviter le fallback Most Aces 43/43 sur joueurs hors cache.
  const topN = topArg ? parseInt(topArg, 10) : 300;
  if (Number.isNaN(topN) || topN <= 0) {
    throw new Error(`--top invalide : "${topArg}"`);
  }
  const eloCachePath = resolve(
    process.cwd(),
    "src/lib/tennis-elo/abstract-cache.json",
  );
  let eloCache: { players: Record<string, { name: string; tour: string }> };
  try {
    eloCache = JSON.parse(readFileSync(eloCachePath, "utf8"));
  } catch (e) {
    throw new Error(
      `Impossible de lire ${eloCachePath} pour le mode --top : ${(e as Error).message}`,
    );
  }
  const byTour = (tour: string) =>
    Object.values(eloCache.players)
      .filter((p) => p.tour === tour)
      .slice(0, topN)
      .map((p) => p.name);
  return [...byTour("ATP"), ...byTour("WTA")];
}

// ---------------------------------------------------------------------------
// Throttle + retry
// ---------------------------------------------------------------------------

const THROTTLE_MS = 1500; // 1 req / 1.5s — conservateur
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wrapper avec retry exponentiel sur 429/5xx. */
async function scrapeWithRetry(
  name: string,
  maxAttempts = 3,
): Promise<{ key: string; name: string; entry: DrCache["players"][string] } | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await scrapePlayerDr(name);
      if (!res) return null;
      return { key: res.key, name, entry: res.entry };
    } catch (err) {
      const msg = (err as Error).message;
      const isTransient = /HTTP 4\d\d|HTTP 5\d\d|fetch failed|ETIMEDOUT|ECONNRESET/i.test(
        msg,
      );
      if (attempt === maxAttempts || !isTransient) {
        console.warn(`  ✗ ${name} : ${msg}`);
        return null;
      }
      const backoff = THROTTLE_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== scrape-tennis-dr ===");
  if (DRY_RUN) console.log("[dry-run] Pas d'écriture du cache.");

  const players = resolvePlayerList();
  console.log(
    `Cible : ${players.length} joueur(s)${playersArg ? "" : ` (top ${topArg ?? 200} ATP+WTA)`}.`,
  );

  // Cache existant (merge incrémental sauf --force).
  const existingCache = FORCE
    ? emptyCache()
    : (() => {
        try {
          return JSON.parse(
            readFileSync(cacheFilePath(), "utf8"),
          ) as DrCache;
        } catch {
          return emptyCache();
        }
      })();
  console.log(
    `Cache actuel : ${Object.keys(existingCache.players).length} joueur(s).`,
  );

  // Merge incrémental intelligent : pour chaque joueur scrapé, on garde
  // l'entrée la PLUS RICHE. Évite qu'un cache ancien (sans serveStats/acesPct)
  // écrase une nouvelle entrée plus complète.
  //
  // Historique bugs Most Aces (43/43 symétrique + aces/match figés) :
  //   - 2026-07-26 : serveStats absent suite à un merge avec un cache
  //     pré-extension → tous les matchs tombaient sur le fallback surface.
  //   - 2026-07-27 : le cache ne couvrait que le top-100 → tout match BSD
  //     impliquant un joueur hors top-100 (challengers/qualifs) retombait en
  //     fallback Skellam symétrique (P(A>B)=P(B>A)=43%, λ=λBase). Fix : cron
  //     passé à --top=300 (544 ATP + 543 WTA disponibles dans abstract-cache).
  const hasServeStats = (e: DrCache["players"][string] | undefined): boolean =>
    !!e && !!e.serveStats && Object.keys(e.serveStats).length > 0;

  const out: DrCache = {
    generatedAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString().slice(0, 10),
    players: { ...existingCache.players },
  };

  let ok = 0;
  let miss = 0;
  let i = 0;
  for (const name of players) {
    i++;
    const result = await scrapeWithRetry(name);
    if (result) {
      // Merge intelligent : on ne remplace l'entrée existante que si la
      // nouvelle est AU MOINS aussi riche (a serveStats ou l'ancienne n'en a
      // pas). Évite de régresser vers un cache sans serveStats/acesPct.
      const existing = out.players[result.key];
      if (!existing || !hasServeStats(existing) || hasServeStats(result.entry)) {
        out.players[result.key] = result.entry;
      }
      ok++;
      const surfaceReport = ["all", "Hard", "Clay", "Grass"]
        .map((s) => {
          const b = (result.entry as unknown as Record<string, { n: number }>)[s];
          return `${s}=${b?.n ?? 0}`;
        })
        .join(" ");
      console.log(
        `  ✓ [${i}/${players.length}] ${name} — DR ${surfaceReport}`,
      );
    } else {
      miss++;
      console.log(
        `  · [${i}/${players.length}] ${name} — aucun match avec DR (skipped)`,
      );
    }
    if (i < players.length) await sleep(THROTTLE_MS);
  }

  console.log("");
  console.log(`Résumé : ${ok} OK, ${miss} sans données, ${players.length} total.`);

  if (DRY_RUN) {
    console.log("[dry-run] Cache NON écrit.");
    return;
  }

  writeCache(out);
  const totalPlayers = Object.keys(out.players).length;
  console.log(
    `✓ Cache écrit : ${cacheFilePath()} (${totalPlayers} joueur(s), lastUpdate: ${out.lastUpdate})`,
  );

  // Sanité : vérifier que Sinner est cohérent si présent.
  const sinnerKey = normalizeKey("Jannik Sinner");
  if (out.players[sinnerKey]) {
    const g = out.players[sinnerKey].Grass;
    if (g && g.median != null) {
      console.log(`  Sanity check : Sinner Grass median = ${g.median} (≈1.50 attendu).`);
    }
  }
}

main().catch((err) => {
  console.error("FATAL:", (err as Error).message);
  process.exit(1);
});
