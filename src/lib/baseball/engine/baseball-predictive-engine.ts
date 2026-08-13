/**
 * Moteur prédictif scientifique PariScore Baseball.
 *
 * Architecture du modèle (documentée pour audit) :
 *  1. Profils de frappe : chaque alignement est projeté face au lanceur
 *     adverse via OPS combiné = 0,62·OPS(équipe, dérivé wRC+) + 0,38·OPS
 *     contre le lanceur. Le park factor s'applique aux frappeurs à domicile.
 *  2. Prior : loi de Bill James (x = 1,83) sur les runs attendus déterministes
 *     (matrice d'espérance de points × profils).
 *  3. Distribution : Monte Carlo manche par manche (matrice RE 2010-2015),
 *     partants en phase 1, bullpens fatigues en phase 2, manches
 *     supplémentaires simulées. RNG seedé → reproductible.
 *  4. Marchés : moneyline (blend 45/55), O/U ligne optimale (seuil confiance
 *     ≥ 65 %), Run Line ±1,5, First 5 Innings (duel 100 % partants).
 */

import {
  CONFIDENCE_THRESHOLD,
  clamp,
  MODEL_VERSION,
  type BatterProfile,
} from "./constants";
import { pythagoreanFromRuns } from "./pythagorean";
import { runMonteCarloBatch } from "./monte-carlo";
import { americanOdds, round1, round2 } from "@/lib/baseball/format";
import type {
  BaseballPrediction,
  League,
  OverUnderSide,
  PitcherRecord,
  TeamRecord,
} from "@/lib/baseball/types";

interface LeagueParams {
  ops: number;
  k9: number;
  bb9: number;
  hr9: number;
  h9: number;
  paPerInning: number;
  runsPerInning: number;
  bullpenEra: number;
  bullpenIp3d: number;
}

/**
 * Rétrécissement (shrinkage) bayésien des taux lanceur vers la moyenne de
 * ligue — méthode standard des systèmes de projection (ZiPS/MARCEL) : les
 * petites tailles d'échantillon et l'effet adversaire imposent de ne jamais
 * faire confiance à 100 % au taux brut du partant.
 */
export const SHRINKAGE = 0.35;

const LEAGUE_PARAMS: Record<League, LeagueParams> = {
  MLB: {
    ops: 0.706,
    k9: 8.6,
    bb9: 3.1,
    hr9: 1.14,
    h9: 8.2,
    paPerInning: 4.35,
    runsPerInning: 0.488,
    bullpenEra: 3.9,
    bullpenIp3d: 12.0,
  },
  KBO: {
    ops: 0.7,
    k9: 7.8,
    bb9: 3.3,
    hr9: 0.85,
    h9: 9.0,
    paPerInning: 4.4,
    runsPerInning: 0.522,
    bullpenEra: 4.2,
    bullpenIp3d: 12.0,
  },
  // NPB (Japon, Central+Pacific, 12 équipes) — run environment plus serré que
  // MLB : frappes de puissance moins nombreuses (HR/9 ≈ 0,65), K tenant mais
  // walks disciplinées. Bullpen généralement le plus solide des ligues asiatiques.
  NPB: {
    ops: 0.665,
    k9: 7.4,
    bb9: 2.8,
    hr9: 0.65,
    h9: 8.0,
    paPerInning: 4.3,
    runsPerInning: 0.388,
    bullpenEra: 3.2,
    bullpenIp3d: 12.0,
  },
  // CPBL (Taïwan, 6 équipes) — ligue favorable aux frappeurs : OPS élevé,
  // strikeout modeste, bullpens plus permissifs (ERA ~ 4,5).
  CPBL: {
    ops: 0.72,
    k9: 6.5,
    bb9: 3.4,
    hr9: 0.7,
    h9: 9.5,
    paPerInning: 4.5,
    runsPerInning: 0.55,
    bullpenEra: 4.5,
    bullpenIp3d: 12.0,
  },
  // LMB (Mexique, 18 équipes) — environnement hitter-friendly à haute altitude
  // (Mexico City, Monterrey), HR plus présents, walks élevés ; bullpens
  // perméables (ERA ≈ 4,6).
  LMB: {
    ops: 0.735,
    k9: 7.0,
    bb9: 3.5,
    hr9: 1.0,
    h9: 9.7,
    paPerInning: 4.4,
    runsPerInning: 0.5,
    bullpenEra: 4.6,
    bullpenIp3d: 12.0,
  },
  // LIDOM (République dominicaine, hiver, 6 équipes) — ligue d'hiver équilibrée :
  // run environment modéré, bullpens solides (beaucoup de prospects MLB).
  LIDOM: {
    ops: 0.68,
    k9: 7.5,
    bb9: 3.4,
    hr9: 0.75,
    h9: 8.6,
    paPerInning: 4.3,
    runsPerInning: 0.45,
    bullpenEra: 3.7,
    bullpenIp3d: 11.5,
  },
  // LVBP (Venezuela, hiver, 8 équipes) — carnavelière offense, contact penalties
  // faibles, bullpens moyens.
  LVBP: {
    ops: 0.685,
    k9: 6.8,
    bb9: 3.6,
    hr9: 0.7,
    h9: 9.0,
    paPerInning: 4.4,
    runsPerInning: 0.48,
    bullpenEra: 4.0,
    bullpenIp3d: 11.5,
  },
};

/** Multiplicateur de fatigue bullpen : manches sur 3 jours + qualité ERA. */
export function bullpenFatigue(
  league: League,
  bullpenEra: number,
  ipLast3: number,
): number {
  const p = LEAGUE_PARAMS[league];
  return clamp(
    1 + 0.18 * (ipLast3 / p.bullpenIp3d - 1) + 0.25 * (bullpenEra / p.bullpenEra - 1),
    0.8,
    1.65,
  );
}

/**
 * Construit le profil de frappe d'une équipe face à un lanceur donné.
 * `fatigue` > 1 dégrade le lanceur (bullpen surchargé).
 */
export function buildBatterProfile(
  league: League,
  teamWrcPlus: number,
  platoonOps: number,
  pitcher: Pick<
    PitcherRecord,
    "kPer9" | "bbPer9" | "hrPer9" | "opsAgainst"
  >,
  parkFactor: number,
  fatigue: number,
): BatterProfile {
  const p = LEAGUE_PARAMS[league];
  // L'ops projeté s'appuie sur le split platoon réel de l'équipe face à la
  // main du lanceur adverse (méthode des systèmes de projection ZiPS/FanGraphs).
  const combinedOps = 0.62 * (platoonOps ?? p.ops) + 0.38 * (pitcher.opsAgainst ?? p.ops);

  // Modèle de confrontation : les trois "true outcomes" (K, BB, HR) sont
  // pilotés à 50 % par le lanceur et à 50 % par la tendance du frappeur,
  // puis rétrécis (shrinkage) vers la moyenne de ligue — méthode standard
  // des systèmes de projection (ZiPS/MARCEL).
  const teamBB9 = p.bb9 * (teamWrcPlus / 100) ** 0.6;
  const teamHR9 = p.hr9 * (teamWrcPlus / 100) ** 0.8;
  const teamK9 = p.k9 * (100 / teamWrcPlus) ** 0.35;

  const confrontK9 = 0.5 * (pitcher.kPer9 ?? p.k9) + 0.5 * teamK9;
  const confrontBB9 = 0.5 * (pitcher.bbPer9 ?? p.bb9) + 0.5 * teamBB9;
  const confrontHR9 = 0.5 * (pitcher.hrPer9 ?? p.hr9) + 0.5 * teamHR9;

  const effK9 = (1 - SHRINKAGE) * confrontK9 + SHRINKAGE * p.k9;
  const effBB9 = (1 - SHRINKAGE) * confrontBB9 + SHRINKAGE * p.bb9;
  const effHR9 = (1 - SHRINKAGE) * confrontHR9 + SHRINKAGE * p.hr9;

  const kMult = clamp(1 - 0.18 * (fatigue - 1), 0.72, 1.15);
  const pStrikeout = clamp(
    (effK9 * (100 / teamWrcPlus) ** 0.18 * kMult) / 9 / p.paPerInning,
    0.04,
    0.5,
  );
  const pWalk = clamp(
    (effBB9 * fatigue) / 9 / p.paPerInning,
    0.02,
    0.22,
  );

  const hr9Eff =
    (effHR9 + (combinedOps - p.ops) * 6.0) * (parkFactor / 100) * fatigue;
  const pHomerun = clamp(hr9Eff / 9 / p.paPerInning, 0.004, 0.1);

  const h9Eff =
    p.h9 * (combinedOps / p.ops) ** 1.5 * (parkFactor / 100) * fatigue;
  const pHits = clamp((h9Eff - hr9Eff) / 9 / p.paPerInning, 0.05, 0.42);

  let pSingle = pHits * 0.72;
  let pDouble = pHits * 0.235;
  let pTriple = pHits * 0.045;

  const nonOutSum =
    pStrikeout + pWalk + pSingle + pDouble + pTriple + pHomerun;
  if (nonOutSum > 0.98) {
    const scale = 0.98 / nonOutSum;
    pSingle *= scale;
    pDouble *= scale;
    pTriple *= scale;
  }
  const pOut = clamp(1 - (pStrikeout + pWalk + pSingle + pDouble + pTriple + pHomerun), 0.02, 0.6);

  return { pStrikeout, pWalk, pSingle, pDouble, pTriple, pHomerun, pOut };
}

export interface PredictionInput {
  gameId: string;
  league: League;
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
  homePitcher: PitcherRecord;
  awayPitcher: PitcherRecord;
  iterations?: number;
}

/** Lignes candidates autour de la moyenne attendue (pas de 0,5). */
export function candidateLines(meanTotal: number): number[] {
  const base = Math.round(meanTotal * 2) / 2;
  const set = new Set<number>();
  for (let d = -1; d <= 1; d += 0.5) {
    set.add(round1(base + d));
  }
  return [...set].sort((a, b) => a - b);
}

function selectLine(
  lines: number[],
  overProbs: number[],
): {
  line: number;
  overProb: number;
  underProb: number;
  confidence: number;
  recommendation: OverUnderSide | null;
} {
  let bestIndex = 0;
  let bestEdge = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const edge = Math.abs(overProbs[i] - 0.5);
    if (edge > bestEdge) {
      bestEdge = edge;
      bestIndex = i;
    }
  }
  const overProb = overProbs[bestIndex];
  const confidence = Math.max(overProb, 1 - overProb);
  return {
    line: lines[bestIndex],
    overProb,
    underProb: 1 - overProb,
    confidence,
    recommendation:
      confidence >= CONFIDENCE_THRESHOLD
        ? overProb > 0.5
          ? "over"
          : "under"
        : null,
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Hash déterministe des entrées — clé de cache VPS. */
export function predictionInputHash(input: PredictionInput): string {
  const { homeTeam, awayTeam, homePitcher, awayPitcher } = input;
  const parts = [
    input.league,
    homeTeam.wrcPlus,
    homeTeam.parkFactor,
    homeTeam.bullpenEra,
    homeTeam.bullpenIpLast3,
    homeTeam.opsVsLhp,
    homeTeam.opsVsRhp,
    awayTeam.wrcPlus,
    awayTeam.bullpenEra,
    awayTeam.bullpenIpLast3,
    awayTeam.opsVsLhp,
    awayTeam.opsVsRhp,
    homePitcher.id,
    homePitcher.throws,
    homePitcher.kPer9 ?? "n/a",
    homePitcher.bbPer9 ?? "n/a",
    homePitcher.hrPer9 ?? "n/a",
    homePitcher.opsAgainst ?? "n/a",
    homePitcher.starterIpAvg ?? "n/a",
    awayPitcher.id,
    awayPitcher.throws,
    awayPitcher.kPer9 ?? "n/a",
    awayPitcher.bbPer9 ?? "n/a",
    awayPitcher.hrPer9 ?? "n/a",
    awayPitcher.opsAgainst ?? "n/a",
    awayPitcher.starterIpAvg ?? "n/a",
    MODEL_VERSION,
    input.iterations ?? FULL_ITERATIONS,
  ];
  return parts.map((v) => `${v}`).join("|");
}

export const FULL_ITERATIONS = 10_000;
export const QUICK_ITERATIONS = 2_500;

/** Point d'entrée unique du moteur. */
export function buildPrediction(input: PredictionInput): BaseballPrediction {
  const iterations = input.iterations ?? FULL_ITERATIONS;
  const { league, homeTeam, awayTeam, homePitcher, awayPitcher } = input;

  const homeFatigue = bullpenFatigue(league, homeTeam.bullpenEra, homeTeam.bullpenIpLast3);
  const awayFatigue = bullpenFatigue(league, awayTeam.bullpenEra, awayTeam.bullpenIpLast3);

  // Historique de terrain : les DEUX équipes frappent dans le parc du home
  // (l'équipe away n'est pas "neutre" — elle est confrontée au même park).
  const park = homeTeam.parkFactor;
  // Split platoon : chaque équipe voit la main du partant adverse.
  const homeOpsVsStarter = awayPitcher.throws === "LHP" ? homeTeam.opsVsLhp : homeTeam.opsVsRhp;
  const awayOpsVsStarter = homePitcher.throws === "LHP" ? awayTeam.opsVsLhp : awayTeam.opsVsRhp;
  // Bullpen adverse : groupe mixte → moyenne des deux splits.
  const homeOpsVsBullpen = (homeTeam.opsVsLhp + homeTeam.opsVsRhp) / 2;
  const awayOpsVsBullpen = (awayTeam.opsVsLhp + awayTeam.opsVsRhp) / 2;

  const setup = {
    homeVsAwayStarter: buildBatterProfile(
      league,
      homeTeam.wrcPlus,
      homeOpsVsStarter,
      awayPitcher,
      park,
      1,
    ),
    awayVsHomeStarter: buildBatterProfile(
      league,
      awayTeam.wrcPlus,
      awayOpsVsStarter,
      homePitcher,
      park,
      1,
    ),
    homeVsAwayBullpen: buildBatterProfile(
      league,
      homeTeam.wrcPlus,
      homeOpsVsBullpen,
      awayPitcher,
      park,
      awayFatigue,
    ),
    awayVsHomeBullpen: buildBatterProfile(
      league,
      awayTeam.wrcPlus,
      awayOpsVsBullpen,
      homePitcher,
      park,
      homeFatigue,
    ),
    homeStarterInnings: clamp(homePitcher.starterIpAvg ?? 5.5, 4.5, 6.5),
    awayStarterInnings: clamp(awayPitcher.starterIpAvg ?? 5.5, 4.5, 6.5),
  };

  const seed = hashString(input.gameId);

  // Passe de calibrage : moyenne Monte Carlo pour centrer les lignes
  // candidates O/U sur la vraie distribution, et prior Pythagoricien de
  // Bill James appliqué sur les mêmes runs attendus (cohérence interne).
  const CALIBRATION_ITERATIONS = Math.min(500, Math.max(200, iterations >> 2));
  const calibration = runMonteCarloBatch(setup, seed, CALIBRATION_ITERATIONS, [], []);
  const pyth = pythagoreanFromRuns(
    calibration.homeExpectedRuns,
    calibration.awayExpectedRuns,
  );
  const centered = candidateLines(calibration.expectedTotal);
  const f5Candidates = candidateLines(calibration.f5ExpectedTotal);
  const batch = runMonteCarloBatch(setup, seed, iterations, centered, f5Candidates);

  const total = selectLine(centered, batch.overProbsByLine);
  const firstFive = selectLine(f5Candidates, batch.f5OverProbsByLine);

  const homeProb = clamp(
    0.45 * pyth.homeWinProb + 0.55 * batch.homeWinProb,
    0.03,
    0.97,
  );

  return {
    modelVersion: MODEL_VERSION,
    seed,
    pythagorean: {
      exponent: pyth.exponent,
      expectedHomeRuns: round2(pyth.expectedHomeRuns),
      expectedAwayRuns: round2(pyth.expectedAwayRuns),
      homeWinProb: pyth.homeWinProb,
    },
    monteCarlo: {
      iterations: batch.iterations,
      homeWinProb: batch.homeWinProb,
      awayWinProb: batch.awayWinProb,
      expectedTotal: round2(batch.expectedTotal),
      stdDevTotal: round2(batch.stdDevTotal),
      marginHomeWinsBy2Plus: batch.marginHomeBy2Plus,
      marginAwayWinsBy2Plus: batch.marginAwayBy2Plus,
      f5: {
        homeWinProb: batch.f5HomeWinProb,
        awayWinProb: batch.f5AwayWinProb,
        expectedTotal: round2(batch.f5ExpectedTotal),
      },
    },
    moneyline: {
      homeProb,
      awayProb: 1 - homeProb,
      homeAmerican: americanOdds(homeProb),
      awayAmerican: americanOdds(1 - homeProb),
    },
    total: {
      ...total,
      expectedTotal: round2(batch.expectedTotal),
    },
    runLine: {
      homeMinusOneAndHalfProb: batch.marginHomeBy2Plus,
      awayPlusOneAndHalfProb: 1 - batch.marginHomeBy2Plus,
    },
    firstFive: {
      homeWinProb: batch.f5HomeWinProb,
      awayWinProb: batch.f5AwayWinProb,
      totalLine: firstFive.line,
      overProb: firstFive.overProb,
      underProb: firstFive.underProb,
      confidence: firstFive.confidence,
      expectedTotal: round2(batch.f5ExpectedTotal),
    },
  };
}
