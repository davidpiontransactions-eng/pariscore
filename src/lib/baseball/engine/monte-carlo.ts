/**
 * Simulation Monte Carlo inning-by-inning.
 * - Phase 1 : les partants affrontent les alignements adverses (le baseball
 *   repose à ~70 % sur le duel de lanceurs).
 * - Phase 2 : bullpens avec multiplicateur de fatigue (manches sur 3 jours).
 * - Manches supplémentaires simulées jusqu'à un vainqueur (bullpens).
 * - RNG Mulberry32 seedé par match+date → résultats reproductibles (QA).
 */

import type { BatterProfile } from "./constants";
import { simulateHalfInning, type Rng } from "./run-expectancy";

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameSimSetup {
  homeVsAwayStarter: BatterProfile;
  awayVsHomeStarter: BatterProfile;
  homeVsAwayBullpen: BatterProfile;
  awayVsHomeBullpen: BatterProfile;
  homeStarterInnings: number;
  awayStarterInnings: number;
}

export interface GameSimResult {
  homeRuns: number;
  awayRuns: number;
  totalRuns: number;
  margin: number; // home - away
  innings: number;
}

const MAX_INNINGS = 14;

/** Simule un match complet (manches supplémentaires incluses). */
export function simulateGame(setup: GameSimSetup, rng: Rng): GameSimResult {
  let homeRuns = 0;
  let awayRuns = 0;

  const homeProfileFor = (inning: number): BatterProfile =>
    inning <= setup.awayStarterInnings
      ? setup.homeVsAwayStarter
      : setup.homeVsAwayBullpen;
  const awayProfileFor = (inning: number): BatterProfile =>
    inning <= setup.homeStarterInnings
      ? setup.awayVsHomeStarter
      : setup.awayVsHomeBullpen;

  let inning = 1;
  for (; inning <= 9; inning += 1) {
    awayRuns += simulateHalfInning(awayProfileFor(inning), rng).runs;
    if (inning === 9 && awayRuns > homeRuns) break; // victoire à domicile scellée
    homeRuns += simulateHalfInning(homeProfileFor(inning), rng).runs;
  }

  // Manches supplémentaires avec les bullpens (plafond MAX_INNINGS)
  while (inning <= MAX_INNINGS && homeRuns === awayRuns) {
    awayRuns += simulateHalfInning(setup.awayVsHomeBullpen, rng).runs;
    homeRuns += simulateHalfInning(setup.homeVsAwayBullpen, rng).runs;
    inning += 1;
  }
  // Cas rarissime d'égalité persistante : départage équiprobable
  if (homeRuns === awayRuns) {
    if (rng() < 0.5) homeRuns += 1;
    else awayRuns += 1;
  }

  return {
    homeRuns,
    awayRuns,
    totalRuns: homeRuns + awayRuns,
    margin: homeRuns - awayRuns,
    innings: Math.min(inning, MAX_INNINGS),
  };
}

/** Simule les 5 premières manches — 100 % duel des partants. */
export function simulateFirstFive(
  setup: GameSimSetup,
  rng: Rng,
): { homeRuns: number; awayRuns: number; totalRuns: number } {
  let homeRuns = 0;
  let awayRuns = 0;
  for (let inning = 1; inning <= 5; inning += 1) {
    awayRuns += simulateHalfInning(setup.awayVsHomeStarter, rng).runs;
    homeRuns += simulateHalfInning(setup.homeVsAwayStarter, rng).runs;
  }
  return { homeRuns, awayRuns, totalRuns: homeRuns + awayRuns };
}

export interface MonteCarloBatchResult {
  iterations: number;
  homeWinProb: number;
  awayWinProb: number;
  expectedTotal: number;
  stdDevTotal: number;
  homeExpectedRuns: number;
  awayExpectedRuns: number;
  marginHomeBy2Plus: number;
  marginAwayBy2Plus: number;
  f5HomeWinProb: number;
  f5AwayWinProb: number;
  f5ExpectedTotal: number;
  f5HomeExpectedRuns: number;
  f5AwayExpectedRuns: number;
  /** P(total > ligne) pour chaque ligne candidate (même ordre que l'entrée). */
  overProbsByLine: number[];
  /** P(total F5 > ligne) pour chaque ligne candidate. */
  f5OverProbsByLine: number[];
}

function mean(values: Float64Array, n: number): number {
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += values[i];
  return s / n;
}

function stdDev(values: Float64Array, n: number, avg: number): number {
  if (n < 2) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += (values[i] - avg) ** 2;
  return Math.sqrt(s / (n - 1));
}

/**
 * Lance le batch Monte Carlo (défaut 10 000 itérations) et calcule dans la
 * même passe les P(total > ligne) pour les lignes candidates O/U et F5.
 */
export function runMonteCarloBatch(
  setup: GameSimSetup,
  seed: number,
  iterations: number,
  lines: number[],
  f5Lines: number[],
): MonteCarloBatchResult {
  const rng = mulberry32(seed);
  const totals = new Float64Array(iterations);
  const overCounts = new Float64Array(lines.length);
  const f5OverCounts = new Float64Array(f5Lines.length);
  let homeWins = 0;
  let marginHomeBy2Plus = 0;
  let marginAwayBy2Plus = 0;
  let homeRunsSum = 0;
  let awayRunsSum = 0;
  let f5HomeWins = 0;
  let f5TotalsSum = 0;
  let f5HomeRunsSum = 0;
  let f5AwayRunsSum = 0;
  let f5Ties = 0;

  for (let i = 0; i < iterations; i += 1) {
    const game = simulateGame(setup, rng);
    totals[i] = game.totalRuns;
    homeRunsSum += game.homeRuns;
    awayRunsSum += game.awayRuns;
    if (game.margin > 0) homeWins += 1;
    if (game.margin >= 2) marginHomeBy2Plus += 1;
    if (game.margin <= -2) marginAwayBy2Plus += 1;
    for (let l = 0; l < lines.length; l += 1) {
      if (game.totalRuns > lines[l]) overCounts[l] += 1;
    }

    const f5 = simulateFirstFive(setup, rng);
    f5TotalsSum += f5.totalRuns;
    f5HomeRunsSum += f5.homeRuns;
    f5AwayRunsSum += f5.awayRuns;
    if (f5.homeRuns > f5.awayRuns) f5HomeWins += 1;
    else if (f5.homeRuns === f5.awayRuns) f5Ties += 1;
    for (let l = 0; l < f5Lines.length; l += 1) {
      if (f5.totalRuns > f5Lines[l]) f5OverCounts[l] += 1;
    }
  }

  const avgTotal = mean(totals, iterations);
  const overProbsByLine: number[] = [];
  for (let l = 0; l < lines.length; l += 1) {
    overProbsByLine.push(overCounts[l] / iterations);
  }
  const f5OverProbsByLine: number[] = [];
  for (let l = 0; l < f5Lines.length; l += 1) {
    f5OverProbsByLine.push(f5OverCounts[l] / iterations);
  }

  return {
    iterations,
    homeWinProb: homeWins / iterations,
    awayWinProb: (iterations - homeWins) / iterations,
    expectedTotal: avgTotal,
    stdDevTotal: stdDev(totals, iterations, avgTotal),
    homeExpectedRuns: homeRunsSum / iterations,
    awayExpectedRuns: awayRunsSum / iterations,
    marginHomeBy2Plus: marginHomeBy2Plus / iterations,
    marginAwayBy2Plus: marginAwayBy2Plus / iterations,
    f5HomeWinProb: (f5HomeWins + f5Ties / 2) / iterations,
    f5AwayWinProb: (iterations - f5HomeWins - f5Ties + f5Ties / 2) / iterations,
    f5ExpectedTotal: f5TotalsSum / iterations,
    f5HomeExpectedRuns: f5HomeRunsSum / iterations,
    f5AwayExpectedRuns: f5AwayRunsSum / iterations,
    overProbsByLine,
    f5OverProbsByLine,
  };
}
