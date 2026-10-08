#!/usr/bin/env bun
/**
 * ingest-basketball-fixtures.ts — cache BSD → table `basketball_fixtures`.
 *
 * Usage :
 *   bun run scripts/ingest-basketball-fixtures.ts          # ingest + résultats
 *   bun run scripts/ingest-basketball-fixtures.ts --dry-run
 *
 * ⚠️ Ce qui est persisté EST ce que le cache contient. Les lignes AH et OU ne
 * sont pas capturées par le cron → elles ne sont pas écrites, pas simulées.
 * Voir `basketball-fixtures-db.ts`.
 */

import fs from "node:fs";
import path from "node:path";

import {
  type BasketballFixtureRow,
  ensureBasketballFixtures,
  upsertBasketballFixtures,
  applyBasketballResult,
  loadBasketballFixtures,
} from "../src/lib/basketball-fixtures-db";
import { devigTwoWay } from "../src/lib/basketball-bsd-cache";

const CACHE = path.join(process.cwd(), "data", "basketball_bsd_cache.json");
const DRY = process.argv.includes("--dry-run");

type CacheFixture = {
  bsdEventId: number;
  leagueBsdId: number;
  leagueName: string;
  scheduledAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  home: { name: string; shortName: string };
  away: { name: string; shortName: string };
  prediction: {
    probHomeWin: number; probAwayWin: number;
    eloHome: number | null; eloAway: number | null;
    confidence: string | null; modelVersion: string | null;
    rejectedFields: string[];
  } | null;
  pregame: {
    homeStanding: { position: number; wins: number; losses: number; matches: number } | null;
    awayStanding: { position: number; wins: number; losses: number; matches: number } | null;
    last10ScoredHome: number | null; last10ScoredAway: number | null;
    last10TotalHome: number | null; last10TotalAway: number | null;
    venue: { name: string; city: string } | null;
  } | null;
  odds: Array<{
    bookmaker: string;
    oddsHome: number | null; oddsAway: number | null;
    fairHome: number | null; fairAway: number | null;
    vigPct: number | null;
  }>;
  ah?: {
    line: number; books: number;
    fairFirst: number; fairSecond: number; vigPct: number;
    bestFirst: number; bestSecond: number;
  } | null;
  ou?: {
    line: number; books: number;
    fairFirst: number; fairSecond: number; vigPct: number;
    bestFirst: number; bestSecond: number;
  } | null;
};

const cache = JSON.parse(fs.readFileSync(CACHE, "utf8")) as {
  fetchedAt: string;
  fixtures: CacheFixture[];
};

const standing = (s: { position: number; wins: number; losses: number; matches: number } | null) =>
  s && s.matches > 0 ? `${s.position}:${s.wins}-${s.losses}` : null;

const rows: BasketballFixtureRow[] = cache.fixtures.map((f) => {
  const ml = f.odds.filter((o) => o.oddsHome != null && o.oddsAway != null);
  // Marge MOYENNE par livre — pas la somme (leçons de l'analyse J4).
  const vigs = ml.map((o) => o.vigPct).filter((v): v is number => v != null);
  const meanVig = vigs.length ? vigs.reduce((a, b) => a + b, 0) / vigs.length : null;
  // Fair = devig proportionnel sur les cotes MOYENNES (une seule valeur par
  // côté, pas un mélange de livres).
  const meanH = ml.length ? ml.reduce((a, o) => a + (o.oddsHome ?? 0), 0) / ml.length : null;
  const meanA = ml.length ? ml.reduce((a, o) => a + (o.oddsAway ?? 0), 0) / ml.length : null;
  const fair = meanH && meanA ? devigTwoWay(meanH, meanA) : null;

  return {
    bsdEventId: f.bsdEventId,
    league: f.leagueName,
    leagueBsdId: f.leagueBsdId,
    scheduledAt: f.scheduledAt,
    status: f.status,
    homeKey: f.home.shortName,
    awayKey: f.away.shortName,
    homeName: f.home.name,
    awayName: f.away.name,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    probHome: f.prediction?.probHomeWin ?? null,
    probAway: f.prediction?.probAwayWin ?? null,
    eloHome: f.prediction?.eloHome ?? null,
    eloAway: f.prediction?.eloAway ?? null,
    confidence: f.prediction?.confidence ?? null,
    modelVersion: f.prediction?.modelVersion ?? null,
    mlOddsHome: meanH,
    mlOddsAway: meanA,
    mlFairHome: fair?.fairHome ?? null,
    mlFairAway: fair?.fairAway ?? null,
    mlVigPct: meanVig,
    mlBooks: ml.length || null,
    homeStanding: standing(f.pregame?.homeStanding ?? null),
    awayStanding: standing(f.pregame?.awayStanding ?? null),
    last10ScoredHome: f.pregame?.last10ScoredHome ?? null,
    last10ScoredAway: f.pregame?.last10ScoredAway ?? null,
    last10TotalHome: f.pregame?.last10TotalHome ?? null,
    last10TotalAway: f.pregame?.last10TotalAway ?? null,
    venue: f.pregame?.venue ? `${f.pregame.venue.name}, ${f.pregame.venue.city}` : null,
    // Lignes AH/OU : null si le cache ne les porte pas (cron antérieur à P-B,
    // ou source sans marché exploitable). Jamais 0.
    ahLine: f.ah?.line ?? null,
    ahBooks: f.ah?.books ?? null,
    ahFairFirst: f.ah?.fairFirst ?? null,
    ahFairSecond: f.ah?.fairSecond ?? null,
    ahVigPct: f.ah?.vigPct ?? null,
    ahBestFirst: f.ah?.bestFirst ?? null,
    ahBestSecond: f.ah?.bestSecond ?? null,
    ouLine: f.ou?.line ?? null,
    ouBooks: f.ou?.books ?? null,
    ouFairFirst: f.ou?.fairFirst ?? null,
    ouFairSecond: f.ou?.fairSecond ?? null,
    ouVigPct: f.ou?.vigPct ?? null,
    ouBestFirst: f.ou?.bestFirst ?? null,
    ouBestSecond: f.ou?.bestSecond ?? null,
    sourceFetchedAt: cache.fetchedAt,
    updatedAt: new Date().toISOString(),
  };
});

console.log(`fixtures à ingérer : ${rows.length}`);
console.log(`avec prédiction    : ${rows.filter((r) => r.probHome != null).length}`);
console.log(`avec cotes ML      : ${rows.filter((r) => r.mlOddsHome != null).length}`);
console.log(`terminés           : ${rows.filter((r) => r.status === "finished").length}`);

if (DRY) {
  console.log("--dry-run : aucun écrit.");
  process.exit(0);
}

const ensured = ensureBasketballFixtures();
console.log(`table basketball_fixtures : ${ensured ? "présente/créée" : "ÉCHEC (base introuvable)"}`);
if (!ensured) process.exit(1);

const { written, skipped } = upsertBasketballFixtures(rows);
console.log(`écrits=${written} ignorés=${skipped}`);

// État des matchs terminés / en cours — vérification explicite demandée.
const finished = rows.filter((r) => r.status === "finished" && r.homeScore != null);
for (const f of finished) applyBasketballResult(f.bsdEventId, f.status, f.homeScore, f.awayScore);

const back = loadBasketballFixtures({ limit: 500 });
console.log("");
console.log(`lus en base : ${back.length}`);
for (const r of back.filter((x) => x.status === "finished" && x.homeScore != null)) {
  console.log(`  FINI ${r.league}  ${r.homeName} ${r.homeScore}-${r.awayScore} ${r.awayName}`);
}
console.log("");
console.log(`sourceFetchedAt distincts : ${new Set(back.map((r) => r.sourceFetchedAt)).size}`);