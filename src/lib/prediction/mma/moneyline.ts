/**
 * Modèle prédictif de l'offre 1xBet MMA/UFC.
 *
 * Pipeline (cf. bead ParisScorebis-pzru) :
 *   1. de-vig des cotes moneyline 1X2 (V1 / X / V2) → probas justes marché
 *   2. edge modèle = écart entre la proba ensembliste PariScore (ps_prob,
 *      blend devig 55% + DRatings 30% + modèle 15%) et la cote 1xBet
 *   3. Kelly fractional via computeKellyStake (cap 0.25)
 *
 * Convention : le match nul (X) compte comme ISSUE PERDANTE pour chaque côté
 * (ps_prob_a + ps_prob_b = 1, le modèle n'a pas de tête "X"). Hypothèse
 * conservatrice documentée : on ne retire pas la part de nul de la perte.
 */

import { computeKellyStake, type KellyResult } from "@/lib/kelly";

export type MoneylineOdds = {
  /** Cote V1 (fighter A) */
  o1: number;
  /** Cote X (nul) — absente si le book ne la propose pas */
  ox?: number | null;
  /** Cote V2 (fighter B) */
  o2: number;
};

export type DevigMoneyline = {
  fair1: number;
  fairX: number;
  fair2: number;
  /** Marge bookmaker : Σ(1/o) − 1 (0 si pas de X) */
  margin: number;
};

/** De-vig 1X2 : p_i = (1/o_i) / Σ(1/o_j). 2 voies si ox absent. */
export function devigMoneyline(o1: number, ox: number | null | undefined, o2: number): DevigMoneyline | null {
  if (!(o1 > 1) || !(o2 > 1)) return null;
  const hasX = ox != null && ox > 1;
  const r1 = 1 / o1;
  const r2 = 1 / o2;
  const rX = hasX ? 1 / (ox as number) : 0;
  const sum = r1 + r2 + rX;
  if (!(sum > 0)) return null;
  return {
    fair1: r1 / sum,
    fairX: rX / sum,
    fair2: r2 / sum,
    margin: sum - 1,
  };
}

export type ModelEdge = {
  /** Edge V1 en fraction (ex. 0.07 = +7 %) */
  edge1: number;
  /** Edge V2 en fraction */
  edge2: number;
  /** Côté le plus intéressant, null si les deux bords sont ≤ 0 */
  best: { side: 1 | 2; edge: number } | null;
};

/**
 * Edge du modèle vs cotes 1xBet : edge_i = p_i × (o_i − 1) − (1 − p_i).
 * p = ps_prob (ensembliste). Le nul compte dans la défaite (voir en-tête).
 */
export function modelEdge(psA: number, o1: number, ox: number | null | undefined, o2: number): ModelEdge | null {
  if (!(o1 > 1) || !(o2 > 1)) return null;
  const p = Math.max(0, Math.min(1, psA));
  // La cote X n'entre pas dans le calcul directement (issue perdue pour les
  // deux côtés) mais on la valide pour rester aligné avec le type 1X2.
  if (ox != null && !(ox > 1)) return null;
  const edge1 = p * (o1 - 1) - (1 - p);
  const edge2 = (1 - p) * (o2 - 1) - p;
  const best =
    edge1 > edge2 && edge1 > 0
      ? { side: 1 as const, edge: edge1 }
      : edge2 > 0
        ? { side: 2 as const, edge: edge2 }
        : null;
  return { edge1, edge2, best };
}

/** Kelly fractional du côté donné, en % de bankroll (0 si edge ≤ 0). */
export function kellyForSide(psA: number, side: 1 | 2, odds: number): KellyResult {
  const p = side === 1 ? psA : 1 - psA;
  return computeKellyStake(p * 100, odds);
}
