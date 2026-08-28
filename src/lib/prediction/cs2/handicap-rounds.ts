import type { RoundDistribution } from "./cs2-predictive-ml-engine";

/**
 * handicap-rounds.ts — Marché handicap rounds CS2.
 * ---------------------------------------------------------------------------------
 * Depuis la distribution Monte-Carlo (t1Wins[i] − t2Wins[i] par simulation), on calcule
 * P(équipe 1 couvre la ligne) = P(diff ≥ ligne) et P(équipe 2 couvre) = P(diff ≤ −ligne).
 * Le marché handicaperound CS2 est sous-exploré en académique mais structurellement
 * similaire au marché Asian Handicap football (Constantinou, arXiv 2003.09384) : zone
 * d'edge potentielle sur lignes fractionnaires (−1.5/−2.5/+1.5/+2.5).
 */

export type HandicapRoundMarket = {
  /** Ligne exprimée côté T1 (ex : 1.5 = T1 doit gagner par ≥2 rounds). */
  line: number;
  /** P(T1 couvre : t1Wins − t2Wins ≥ line). */
  probT1Cover: number;
  /** P(T2 couvre : t2Wins − t1Wins ≥ line). */
  probT2Cover: number;
  /** Probabilité de push (diff exactement = ligne entière) — ligne fractionnaire => 0. */
  probPush: number;
};

/**
 * Calcule les marchés handicap rounds pour une liste de lignes.
 * @param dist Distribution MC simulée (t1Wins/t2Wins par itération).
 * @param lines Lignes de handicap (côté T1), ex [1.5, 2.5, 3.5].
 * @param sims Nombre de simulations utilisées (borné par dist).
 */
export function handicapRoundMarkets(
  dist: RoundDistribution,
  lines: readonly number[],
  sims?: number,
): HandicapRoundMarket[] {
  const n = Math.min(sims ?? dist.t1Wins.length, dist.t1Wins.length, dist.t2Wins.length);
  if (n <= 0) return [];

  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    diffs.push(dist.t1Wins[i] - dist.t2Wins[i]);
  }

  return lines.map((line) => {
    const eps = 1e-9;
    let t1Cover = 0;
    let t2Cover = 0;
    let push = 0;
    for (const d of diffs) {
      if (d >= line + eps) t1Cover++;
      else if (d <= -line - eps) t2Cover++;
      else if (Math.abs(Math.abs(d) - line) <= eps) push++;
    }
    return {
      line,
      probT1Cover: t1Cover / n,
      probT2Cover: t2Cover / n,
      probPush: push / n,
    };
  });
}