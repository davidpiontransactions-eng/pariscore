#!/usr/bin/env node
/**
 * scrape-tennis-elo-weekly.ts
 *
 * Cron hebdomadaire (lundi 14h heure Paris — PM2 pariscore-cron-elo-weekly) :
 *  1. Scrape les pages Elo ATP + WTA de tennisabstract.com
 *  2. Upsert les snapshots hebdomadaires en DB (TennisEloSnapshot, clé weekIso)
 *  3. Pour chaque joueur (top N), scrape le jsfrags → matchs récents
 *     (adversaire, surface, résultat, score, semaine ISO) → TennisPlayerMatch
 *
 * Le cache JSON legacy (src/lib/tennis-elo/abstract-cache.json) est aussi
 * régénéré (lecture à chaud par lookup.ts) puis copié vers .next/standalone/.
 *
 * Usage:
 *   bun run scripts/scrape-tennis-elo-weekly.ts            # top 300 ATP+WTA
 *   bun run scripts/scrape-tennis-elo-weekly.ts --top=200  # top personnalisé
 *   bun run scripts/scrape-tennis-elo-weekly.ts --dry-run  # parse sans écrire
 *
 * Exit codes: 0 succès, 1 échec.
 */
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAndParse, cacheFilePath, type AbstractCache } from "../src/lib/tennis-elo/scraper";
import { parseJsfragMatches, weekIso } from "../src/lib/tennis-elo/jsfrag";
import { prisma } from "../src/lib/prisma";

// ⚠️ CONFORMITÉ : TennisAbstract interdit /jsfrags/ dans son robots.txt.
// Ce script ne s'exécute QUE si LEGAL_OVERRIDE_CONFIRMED=1 (même garde-fou
// que scripts/scrape-tennis-dr.ts). L'opérateur est seul responsable du
// respect des ToS du site.
if (process.env.LEGAL_OVERRIDE_CONFIRMED !== "1") {
  console.error("FATAL: LEGAL_OVERRIDE_CONFIRMED=1 requis (robots.txt de TennisAbstract interdit /jsfrags/).");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const TOP_ARG = process.argv.find((a) => a.startsWith("--top="));
const TOP = TOP_ARG ? parseInt(TOP_ARG.split("=")[1], 10) || 300 : 300;
const THROTTLE_MS = 1500; // poli envers tennisabstract (1 req / 1.5s)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slug CamelCase TennisAbstract ("Jannik Sinner" → "JannikSinner"). */
function toAbstractSlug(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .trim();
}

type SnapshotInput = {
  playerKey: string;
  playerName: string;
  tour: string;
  weekIso: string;
  eloOverall: number;
  eloHard: number;
  eloClay: number;
  eloGrass: number;
  hEloRank: number;
  cEloRank: number;
  gEloRank: number;
};

async function fetchJsfrag(slug: string): Promise<string> {
  const url = `https://www.tennisabstract.com/jsfrags/${slug}.js`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`jsfrags ${slug}: HTTP ${res.status}`);
  const txt = await res.text();
  if (txt.length < 1000 || !txt.includes("player_frag")) throw new Error(`jsfrags ${slug}: contenu invalide (${txt.length} octets)`);
  return txt;
}

async function main() {
  console.log("=== scrape-tennis-elo-weekly ===");
  const now = new Date();
  const currentWeek = weekIso(now);
  console.log(`Week courante: ${currentWeek} | top=${TOP} | dry-run=${DRY_RUN}`);

  // ── 1. Pages Elo ATP + WTA ───────────────────────────────────────────
  console.log("[1/4] Scraping pages Elo ATP + WTA...");
  const cache: AbstractCache = await fetchAndParse();
  const entries = Object.values(cache.players);
  const atp = entries.filter((p) => p.tour === "ATP");
  const wta = entries.filter((p) => p.tour === "WTA");
  console.log(`  Parsed: ${atp.length} ATP + ${wta.length} WTA`);

  // ── 2. Snapshots hebdomadaires ───────────────────────────────────────
  console.log("[2/4] Upsert snapshots TennisEloSnapshot...");
  const keyed = new Map<string, SnapshotInput>();
  for (const p of [...atp, ...wta]) {
    keyed.set(normalizeKeyOf(p), {
      playerKey: normalizeKeyOf(p),
      playerName: p.name,
      tour: p.tour,
      weekIso: currentWeek,
      eloOverall: p.elo,
      eloHard: p.hElo,
      eloClay: p.cElo,
      eloGrass: p.gElo,
      hEloRank: p.hEloRank,
      cEloRank: p.cEloRank,
      gEloRank: p.gEloRank,
    });
  }
  const uniqueSnapshots = [...keyed.values()];

  if (DRY_RUN) {
    console.log(`  [dry-run] ${uniqueSnapshots.length} snapshots prêts (non écrits)`);
  } else {
    let created = 0, updated = 0;
    for (const sd of uniqueSnapshots) {
      const existing = await prisma.tennisEloSnapshot.findUnique({
        where: { playerKey_weekIso: { playerKey: sd.playerKey, weekIso: currentWeek } },
      });
      if (existing) {
        await prisma.tennisEloSnapshot.update({ where: { id: existing.id }, data: sd });
        updated++;
      } else {
        await prisma.tennisEloSnapshot.create({ data: sd });
        created++;
      }
    }
    console.log(`  ✓ ${created} créés, ${updated} mis à jour (total ${uniqueSnapshots.length})`);
  }

  // ── 3. Matchs récents par joueur (top N) ─────────────────────────────
  console.log(`[3/4] Scraping jsfrags (top ${TOP} par tour)...`);
  const targets = [...atp.slice(0, TOP), ...wta.slice(0, TOP)];
  let matchesParsed = 0, failures = 0;

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i];
    const playerKey = normalizeKeyOf(p);
    if (i % 50 === 0) console.log(`  joueur ${i + 1}/${targets.length}: ${p.name}`);
    try {
      const txt = await fetchJsfrag(toAbstractSlug(p.name));
      const parsed = parseJsfragMatches(txt, p.name);
      matchesParsed += parsed.length;

      if (!DRY_RUN && parsed.length > 0) {
        for (const m of parsed) {
          await prisma.tennisPlayerMatch.upsert({
            where: {
              playerKey_date_opponentKey_round: {
                playerKey, date: m.dateObj, opponentKey: m.opponentKey, round: m.round,
              },
            },
            update: {
              playerName: p.name, tour: p.tour, weekIso: m.weekIso, surface: m.surface,
              tournament: m.tournament, opponentName: m.opponentName, result: m.result, score: m.score,
            },
            create: {
              playerKey, playerName: p.name, tour: p.tour, date: m.dateObj, weekIso: m.weekIso,
              surface: m.surface, tournament: m.tournament, round: m.round,
              opponentKey: m.opponentKey, opponentName: m.opponentName, result: m.result, score: m.score,
            },
          });
        }
      }
    } catch (e) {
      failures++;
      if (failures <= 5) console.warn(`  ⚠ ${p.name}: ${(e as Error).message}`);
    }
    await sleep(THROTTLE_MS);
  }
  console.log(`  Matchs parsés: ${matchesParsed} | échecs: ${failures}`);

  // ── 4. Cache JSON legacy + sync standalone ───────────────────────────
  console.log("[4/4] Écriture cache JSON legacy...");
  if (!DRY_RUN) {
    const outPath = cacheFilePath();
    writeFileSync(outPath, JSON.stringify(cache, null, 2), "utf8");
    const standalonePath = resolve(process.cwd(), ".next/standalone/src/lib/tennis-elo/abstract-cache.json");
    try {
      mkdirSync(resolve(standalonePath, ".."), { recursive: true });
      copyFileSync(outPath, standalonePath);
      console.log(`  ✓ cache → ${outPath} + standalone`);
    } catch (e) {
      console.log(`  ✓ cache → ${outPath} (standalone non dispo: ${(e as Error).message})`);
    }
  } else {
    console.log("  [dry-run] cache non écrit");
  }

  console.log("=== scrape-tennis-elo-weekly OK ===");
}

function normalizeKeyOf(p: { name: string }): string {
  return p.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

main()
  .catch((err) => {
    console.error("FATAL:", (err as Error).message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => {}));