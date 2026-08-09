import { normalizeMatrix, round2 } from "./math-utils";
import type { Markets, ScoreMatrix, TopScore } from "./types";

/**
 * P(X = k) pour une loi de Poisson de moyenne λ, calculé en log pour éviter
 * les underflows sur les grandes valeurs de k.
 */
export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda) || k < 0) return 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda) - Math.log(i);
  return Math.exp(logP);
}

/** Approximation de Poisson : P(X > k) = 1 - P(X ≤ k). Retourne une probabilité 0-100. */
export function poissonOver(k: number, lambda: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda)) return 0;
  if (k < 0) return lambda > 0 ? 100 : 0;
  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    cdf += term;
    term *= lambda / (i + 1);
    if (term < 1e-15 || !Number.isFinite(term)) break;
  }
  return (1 - cdf) * 100;
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, max = 8): ScoreMatrix {
  const m: ScoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) row.push(poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a));
    m.push(row);
  }
  return normalizeMatrix(m);
}

export function marketsFromMatrix(matrix: ScoreMatrix): Markets {
  const max = matrix.length - 1;
  let homeWin = 0, draw = 0, awayWin = 0;
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
  let under15 = 0, under35 = 0, btts = 0;
  const scores: TopScore[] = [];
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p; else if (h === a) draw += p; else awayWin += p;
      const total = h + a;
      if (total >= 1) over05 += p;
      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;
      if (total <= 1) under15 += p;
      if (total <= 3) under35 += p;
      if (h >= 1 && a >= 1) btts += p;
      scores.push({ home: h, away: a, prob: p });
    }
  }
  scores.sort((x, y) => y.prob - x.prob);
  const p1x = homeWin + draw, px2 = draw + awayWin, p12 = homeWin + awayWin;
  const dc = p1x >= px2 && p1x >= p12 ? { selection: "1X" as const, prob: round2(p1x * 100) }
    : px2 >= p12 ? { selection: "X2" as const, prob: round2(px2 * 100) }
    : { selection: "12" as const, prob: round2(p12 * 100) };
  return {
    homeWin: round2(homeWin * 100), draw: round2(draw * 100), awayWin: round2(awayWin * 100),
    over05: round2(over05 * 100), over15: round2(over15 * 100), over25: round2(over25 * 100),
    over35: round2(over35 * 100), under15: round2(under15 * 100), under35: round2(under35 * 100),
    btts: round2(btts * 100), dc,
    topScores: scores.slice(0, 5),
  };
}

export function poissonMarkets(lambdaHome: number, lambdaAway: number): Markets {
  const mk = marketsFromMatrix(buildScoreMatrix(lambdaHome, lambdaAway));
  const lambdaCorners = Math.max(lambdaHome + lambdaAway, 0.5);
  mk.cornersOver = { line: 8.5, prob: round2(Math.min(99, poissonOver(8, lambdaCorners))) };
  return mk;
}