// Dixon-Coles model — extends Poisson with low-score correlation parameter ρ.
// Ref: Dixon & Coles (1997) "Modelling Association Football Scores"
//
// Key addition over standard Poisson:
//   P(X=x, Y=y) = τ(x,y) × Poisson(x|λ) × Poisson(y|μ)
// where τ(x,y) adjusts for the empirical correlation at low scores (0-0, 1-0, 0-1, 1-1).
//
// ρ = correlation parameter (typically -0.05 to 0.15, negative = fewer draws than Poisson predicts)

import { poissonPMF } from "./poisson";
import { round2, normalizeMatrix } from "./math-utils";
import type { ScoreMatrix, Markets, TopScore } from "./types";

// ---------------------------------------------------------------------------
// Dixon-Coles adjustment τ(x, y)
// ---------------------------------------------------------------------------

/**
 * τ(x, y) — Dixon-Coles adjustment for low scores.
 * τ = 1 - λ×μ×ρ if x=0,y=0
 * τ = 1 + λ×ρ    if x=0,y=1
 * τ = 1 + μ×ρ    if x=1,y=0
 * τ = 1 - ρ      if x=1,y=1
 * τ = 1          otherwise
 */
function tau(x: number, y: number, lambdaHome: number, lambdaAway: number, rho: number): number {
  if (x === 0 && y === 0) return Math.max(0, 1 - lambdaHome * lambdaAway * rho);
  if (x === 0 && y === 1) return Math.max(0, 1 + lambdaHome * rho);
  if (x === 1 && y === 0) return Math.max(0, 1 + lambdaAway * rho);
  if (x === 1 && y === 1) return Math.max(0, 1 - rho);
  return 1;
}

// ---------------------------------------------------------------------------
// Dixon-Coles score matrix
// ---------------------------------------------------------------------------

/**
 * Builds a Dixon-Coles adjusted score matrix.
 * P(x, y) ∝ τ(x, y) × Poisson(x|λ) × Poisson(y|μ)
 * Normalized so sum = 1.
 */
export function buildDixonColesMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = 0.05,
  max = 8,
): ScoreMatrix {
  const m: ScoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) {
      const poissonJoint = poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a);
      const adj = tau(h, a, lambdaHome, lambdaAway, rho);
      row.push(Math.max(0, poissonJoint * adj));
    }
    m.push(row);
  }
  return normalizeMatrix(m);
}

// ---------------------------------------------------------------------------
// Markets extraction (reuses the same logic as poisson.ts)
// ---------------------------------------------------------------------------

export function dixonColesMarkets(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = 0.05,
): Markets {
  const matrix = buildDixonColesMatrix(lambdaHome, lambdaAway, rho);
  const max = matrix.length - 1;

  let homeWin = 0, draw = 0, awayWin = 0;
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
  let under15 = 0, under35 = 0, btts = 0;
  const scores: TopScore[] = [];

  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;

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
  const dc = p1x >= px2 && p1x >= p12
    ? { selection: "1X" as const, prob: round2(p1x * 100) }
    : px2 >= p12
      ? { selection: "X2" as const, prob: round2(px2 * 100) }
      : { selection: "12" as const, prob: round2(p12 * 100) };

  return {
    homeWin: round2(homeWin * 100),
    draw: round2(draw * 100),
    awayWin: round2(awayWin * 100),
    over05: round2(over05 * 100),
    over15: round2(over15 * 100),
    over25: round2(over25 * 100),
    over35: round2(over35 * 100),
    under15: round2(under15 * 100),
    under35: round2(under35 * 100),
    btts: round2(btts * 100),
    dc,
    topScores: scores.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Log-likelihood for ρ calibration (useful for backtesting)
// ---------------------------------------------------------------------------

/**
 * Log-likelihood of observed score (h, a) under Dixon-Coles.
 * Used for MLE estimation of ρ during backtesting.
 */
export function dcLogLikelihood(
  h: number, a: number,
  lambdaHome: number, lambdaAway: number,
  rho: number,
): number {
  const pPoisson = poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a);
  if (pPoisson <= 0) return -Infinity;
  const adj = tau(h, a, lambdaHome, lambdaAway, rho);
  if (adj <= 0) return -Infinity;
  return Math.log(pPoisson) + Math.log(adj);
}
