/**
 * Vérification déterministe du fix baseball : le moteur produit une
 * prédiction valide (aucune NaN, probas dans (0,1)) même quand les stats
 * de saison des lanceurs partants sont absentes (statsAvailable=false).
 * Utilise les vraies équipes du registry (MLB).
 * Usage: bun scripts/verify-baseball-quick-fix.ts
 */
import { buildPrediction, FULL_ITERATIONS } from "../src/lib/baseball/engine/baseball-predictive-engine";
import { MLB_TEAM_RECORDS } from "../src/lib/baseball/registry";
import type { BaseballPrediction, PitcherRecord } from "../src/lib/baseball/types";

function assert(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

function noStatsPitcher(id: string, name: string, teamCode: string, throws: "LHP" | "RHP"): PitcherRecord {
  return {
    id,
    league: "MLB",
    teamId: `MLB:${teamCode}`,
    name,
    throws,
    era: null,
    whip: null,
    fip: null,
    xEra: null,
    kPer9: null,
    bbPer9: null,
    hrPer9: null,
    wins: null,
    losses: null,
    inningsPitched: null,
    opsAgainst: null,
    starterIpAvg: null,
    statsAvailable: false,
    source: "curated",
    season: 2026,
  };
}

const nyy = MLB_TEAM_RECORDS.find((t) => t.code === "NYY")!;
const bos = MLB_TEAM_RECORDS.find((t) => t.code === "BOS")!;
if (!nyy || !bos) {
  console.error("FAIL: NYY/BOS introuvables dans MLB_TEAM_RECORDS");
  process.exit(1);
}

const input = {
  gameId: "verify-no-stats-001",
  league: "MLB" as const,
  homeTeam: nyy,
  awayTeam: bos,
  homePitcher: noStatsPitcher("MLB:666001", "Rookie Home", "NYY", "RHP"),
  awayPitcher: noStatsPitcher("MLB:666002", "Rookie Away", "BOS", "LHP"),
  iterations: FULL_ITERATIONS,
};

const p: BaseballPrediction = buildPrediction(input);

const nums: (number | null | undefined)[] = [
  p.moneyline.homeProb,
  p.moneyline.awayProb,
  p.total.line,
  p.total.overProb,
  p.total.underProb,
  p.total.confidence,
  p.total.expectedTotal,
  p.monteCarlo.stdDevTotal,
];
assert(nums.every((n) => typeof n === "number" && Number.isFinite(n)), "aucune NaN/infini (stats partants absentes)");
assert(p.total.overProb > 0.01 && p.total.overProb < 0.99, `overProb non dégénéré: ${p.total.overProb}`);
assert(p.moneyline.homeProb > 0 && p.moneyline.homeProb < 1, `homeProb dans (0,1): ${p.moneyline.homeProb}`);
assert(Math.abs(p.moneyline.homeProb + p.moneyline.awayProb - 1) < 0.001, `probas moneyline normalisées`);
assert(p.total.expectedTotal > 0, `total attendu positif: ${p.total.expectedTotal}`);
assert(p.monteCarlo.stdDevTotal > 0, `stdDev > 0 (distribution non dégénérée): ${p.monteCarlo.stdDevTotal}`);

console.log(`\nRésultat: totalLine=${p.total.line} overProb=${p.total.overProb.toFixed(3)} expectedTotal=${p.total.expectedTotal.toFixed(2)} homeProb=${p.moneyline.homeProb.toFixed(3)} stdDev=${p.monteCarlo.stdDevTotal.toFixed(2)}`);
console.log("VERIFY OK — prédictions O/U + winner calculées sans stats de saison, distribution saine.");