import { buildScoreMatrix } from "@/lib/prediction/football/poisson";
import { aggregateFromSources } from "@/lib/services/predictive-engine";

/* ─── Matrice scores exacts façon BeSoccer ─── */

export type ScoreCell = { home: number; away: number; prob: number }; // prob 0-1
export type MarginProb = { diff: number; prob: number }; // marge domicile +N

export type ScoreMatrixResult = {
  matrix: ScoreCell[][];
  margins: MarginProb[];
  lambdaHome: number;
  lambdaAway: number;
  homeWin: number; // 0-1
  awayWin: number; // 0-1
};

/**
 * Matrice des scores exacts 0..max (Poisson bivarié indépendant) + colonne
 * des marges domicile, depuis les cotes 1X2 (lambdas estimés).
 */
export function scoreMatrixForMatch(o: {
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  max?: number;
}): ScoreMatrixResult {
  const max = o.max ?? 10;
  const input = aggregateFromSources({
    bsd: {
      matchId: "matrix",
      homeTeam: "H",
      awayTeam: "A",
      sport: "football",
      odds_home: o.homeOdds ?? undefined,
      odds_draw: o.drawOdds ?? undefined,
      odds_away: o.awayOdds ?? undefined,
    },
  });
  const raw = buildScoreMatrix(input.lambdaHome, input.lambdaAway, max);
  const matrix: ScoreCell[][] = raw.map((row, h) => row.map((prob, a) => ({ home: h, away: a, prob })));
  const margins: MarginProb[] = [];
  let homeWin = 0;
  for (let d = 1; d <= max; d++) {
    let p = 0;
    for (let h = d; h <= max; h++) p += raw[h][h - d];
    margins.push({ diff: d, prob: p });
  }
  for (let h = 0; h <= max; h++) for (let a = 0; a < h; a++) homeWin += raw[h][a];
  let awayWin = 0;
  for (let h = 0; h <= max; h++) for (let a = h + 1; a <= max; a++) awayWin += raw[h][a];
  return { matrix, margins, lambdaHome: input.lambdaHome, lambdaAway: input.lambdaAway, homeWin, awayWin };
}
