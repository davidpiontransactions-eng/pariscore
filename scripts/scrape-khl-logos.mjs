#!/usr/bin/env node
/**
 * scrape-khl-logos.mjs
 *
 * Rapattrie les 22 blasons officiels KHL depuis HockeyTech (teamsbyseason)
 * vers public/logos/hockey/khl/, et écrit un manifeste SHA-256.
 *
 * Source : lscluster.hockeytech.com/feed/ (modulekit) via le proxy public
 * khl.shayy.workers.dev — l'accès direct rend « Client access denied »
 * (blocage IP). Vue `teamsbyseason` : mesurée fiable (573-1037 ms, 6/6).
 * Les URLs sont officielles (thumbs.webcaster.pro), 200x200 → 500x500.
 *
 * Usage :
 *   node scripts/scrape-khl-logos.mjs --dry-run   # liste + URLs, rien écrit
 *   node scripts/scrape-khl-logos.mjs             # télécharge + manifeste
 *
 * Garde-fous (aucun blason inventé, aucun placeholder toléré) :
 *  - signature PNG vérifiée (magic bytes) ;
 *  - taille minimale ;
 *  - SHA-256 unique : une empreinte partagée entre deux équipes signerait
 *    un placeholder générique → échec bloquant ;
 *  - la saison est validée par son année, pas par sa position dans le tableau
 *    (le feed n'est PAS garanti trié — cf. le piège documenté plus bas).
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PROXY = "https://khl.shayy.workers.dev?url=";
const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public", "logos", "hockey", "khl");
const MANIFEST = join(ROOT, "public", "logos", "hockey", "manifest.json");

const DRY_RUN = process.argv.includes("--dry-run");
const FETCH_TIMEOUT_MS = 60_000;
const FETCH_ATTEMPTS = 4;

function feedUrl(params) {
  const qs = new URLSearchParams({
    feed: "modulekit",
    fmt: "json",
    key: "khl",
    client_code: "khl",
    lang: "en",
    ...params,
  });
  return `${PROXY}${encodeURIComponent(`https://lscluster.hockeytech.com/feed/?${qs}`)}`;
}

/**
 * Le proxy peut renvoyer un payload tronqué (timeout upstream) au lieu d'une
 * erreur HTTP : `SiteKit.X.error = "SyntaxError: Unterminated string…"`.
 * Toute réponse contenant un `.error` est donc un échec, pas un résultat vide.
 */
async function feed(params, attempts = FETCH_ATTEMPTS) {
  let last = "aucune tentative";
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(feedUrl(params), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
      } else {
        const siteKit = (await res.json())?.SiteKit;
        const broken = siteKit && Object.entries(siteKit).find(([, v]) => v && typeof v === "object" && v.error);
        if (broken) last = `payload tronqué (${String(broken[1].error).slice(0, 60)})`;
        else if (siteKit) return siteKit;
        else last = "SiteKit absent";
      }
    } catch (e) {
      last = `${e?.name ?? "erreur"}`;
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`HockeyTech ${params.view ?? "?"} inaccessible après ${attempts} tentatives : ${last}`);
}

/**
 * Choisit la saison courante PAR SON ANNÉE, jamais par index.
 * Le feed renvoie 39 saisons dans un ordre non documenté : mesuré
 * [0] = 407 / 2026-2027 … [38] = 27 / 2008-2009. Lire `S.at(-1)` renvoie donc
 * une saison de 2008-2009 avec des données realistes et sans aucun signal
 * d'erreur — un_PIÈGE_ déjà payé une fois.
 */
function pickCurrentSeason(seasons) {
  const now = new Date();
  const thisYear = String(now.getUTCFullYear());
  const nextYear = String(now.getUTCFullYear() + 1);
  const current = seasons.find((s) => {
    const name = String(s.season_name ?? "");
    return name.includes(thisYear) || name.includes(nextYear);
  });
  if (!current) {
    throw new Error(
      `Aucune saison ${thisYear}-${nextYear} parmi ${seasons.length} saisons — ` +
        `refus d'écrire des logos d'une saison inconnue`
    );
  }
  return current;
}

/** PNG : magic + dimensions lues dans le chunk IHDR (offset 16). */
function readPngHeader(buf) {
  const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(MAGIC)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("[khl-logos] Résolution de la saison courante…");
  const seasons = (await feed({ view: "seasons" })).Seasons;
  const season = pickCurrentSeason(seasons);
  console.log(`[khl-logos] season_id=${season.season_id} (${season.season_name}) — ${seasons.length} saisons disponibles`);

  const teams = (await feed({ view: "teamsbyseason", season_id: String(season.season_id) })).Teamsbyseason;
  if (!Array.isArray(teams) || teams.length === 0) throw new Error("teamsbyseason vide");

  const entries = teams.filter((t) => t.team_logo_url);
  const sansLogo = teams.filter((t) => !t.team_logo_url);
  console.log(`[khl-logos] ${teams.length} équipes, ${entries.length} avec blason officiel, ${sansLogo.length} sans`);

  if (DRY_RUN) {
    for (const t of teams) {
      console.log(`  ${String(t.id).padEnd(4)} ${t.code ?? "?"} ${t.name} → ${t.team_logo_url ?? "AUCUN"}`);
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];
  const seenSha = new Map();

  for (const t of entries) {
    const file = `${t.code ?? t.id}.png`;
    const buf = await download(t.team_logo_url);

    const png = readPngHeader(buf);
    if (!png) throw new Error(`${file} : ce n'est pas un PNG (${buf.length}o) — blason refusé`);
    if (buf.length < 1024) throw new Error(`${file} : ${buf.length}o, trop petit pour un blason — refusé`);
    if (png.width < 100 || png.height < 100) {
      throw new Error(`${file} : ${png.width}x${png.height}, résolution insuffisante — refusé`);
    }

    const sha = createHash("sha256").update(buf).digest("hex");
    const previous = seenSha.get(sha);
    if (previous) {
      throw new Error(
        `placeholder détecté : ${file} a la même empreinte que ${previous} — ` +
          `un blason générique ne peut pas représenter deux clubs`
      );
    }
    seenSha.set(sha, file);

    writeFileSync(join(OUT_DIR, file), buf);
    manifest.push({
      id: t.id,
      code: t.code ?? null,
      name: t.name,
      nickname: t.nickname ?? null,
      city: t.city ?? null,
      division: t.division_long_name || null,
      file: `hockey/khl/${file}`,
      source: t.team_logo_url,
      width: png.width,
      height: png.height,
      bytes: buf.length,
      sha256: sha,
    });
    console.log(`  ✓ ${file.padEnd(8)} ${String(png.width).padStart(3)}x${String(png.height).padEnd(3)} ${String(buf.length).padStart(6)}o ${sha.slice(0, 12)}`);
  }

  // Le manifeste doit décrire exactement ce qui est sur le disque.
  const disque = manifest.filter((m) => existsSync(join(ROOT, "public", "logos", m.file))).length;
  if (disque !== manifest.length) {
    throw new Error(`manifeste incohérent : ${disque}/${manifest.length} fichiers présents sur le disque`);
  }

  // Conserve les entrées d'autres ligues si le manifeste en contient déjà.
  const precedent = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const autres = Object.fromEntries(
    Object.entries(precedent).filter(([k, v]) => k !== "khl" && k !== "counts" && k !== "season" && v != null)
  );

  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        generator: "scripts/scrape-khl-logos.mjs",
        source: "HockeyTech modulekit teamsbyseason (proxy khl.shayy.workers.dev)",
        season: { id: season.season_id, name: season.season_name },
        counts: { teams: teams.length, withLogo: manifest.length, withoutLogo: sansLogo.length },
        khl: manifest,
        ...(Object.keys(autres).length ? { autres } : {}),
      },
      null,
      2,
    ) + "\n"
  );

  console.log(`[khl-logos] ${manifest.length} blasons écrits dans public/logos/hockey/khl/`);
  console.log(`[khl-logos] manifeste : ${MANIFEST}`);
}

main().catch((e) => {
  console.error(`[khl-logos] ECHEC : ${e.message}`);
  process.exit(1);
});