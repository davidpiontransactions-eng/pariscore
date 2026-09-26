// Pill « Over XX pts conseillé » du Top 10 Vitibet — bead ParisScorebis-f1qc.
//
// Modèle zéro-dépendance : distribution normale centrée sur le total prédit
// Vitibet (score_predit_d + score_predit_e), σ = écart-type empirique des
// ERREURS de prédiction calculé en base (db.ts → scoreErrorSigma) sur les
// matchs finished avec scores complets.
//
// Règle métier : retenir la ligne x.5 LA PLUS HAUTE avec P(total > ligne)
// ≥ 65 %. Si aucune ligne de la grille n'atteint le seuil → aucun conseil
// (retour null) — on n'affiche JAMAIS une pill sous le seuil.

/** Seuil de réussite minimal (demande user : ≥ 65 %). */
export const OVER_FLOOR = 0.65;

/** Grille de lignes x.5 (bornes réalistes du handball, du haut vers le bas). */
const LINE_MAX = 75.5;
const LINE_MIN = 40.5;

export type OverPick = {
  /** Ligne retenue (x.5). */
  line: number;
  /** P(total > ligne) — ≥ OVER_FLOOR par construction. */
  prob: number;
};

/** Approximation d'Abramowitz & Stegun 7.1.26 (|ε| < 1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/** CDF normale standard Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * P(total > ligne) sous N(total prédit, σ²).
 * Retourne null si les entrées sont invalides (σ ≤ 0, non fini).
 */
export function overProb(predTotal: number, sigma: number, line: number): number | null {
  if (!Number.isFinite(predTotal) || !Number.isFinite(sigma) || !Number.isFinite(line)) return null;
  if (sigma <= 0) return null;
  return 1 - normalCdf((line - predTotal) / sigma);
}

/**
 * Meilleure ligne Over conseillée : la plus haute ligne x.5 de la grille avec
 * P(total > ligne) ≥ `floor` (65 %). Tri décroissant → P décroît → le premier
 * qualifiant est le plus haut. Aucun qualifiant → null (pas de pill).
 */
export function bestOverLine(
  predTotal: number,
  sigma: number | null,
  floor: number = OVER_FLOOR,
): OverPick | null {
  if (sigma == null) return null;
  for (let line = LINE_MAX; line >= LINE_MIN; line -= 1) {
    const p = overProb(predTotal, sigma, line);
    if (p != null && p >= floor) return { line, prob: p };
  }
  return null;
}
