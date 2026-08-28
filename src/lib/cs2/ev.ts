/**
 * ev.ts — Expected value, devig, Kelly fraction et gate de verdict bet.
 * ---------------------------------------------------------------------------------
 * Fondement académique (benchmark 2026-08-28) :
 *  - La calibration prime l'accuracy pour la rentabilité (Walsh & Joshi, arXiv 2303.06021).
 *  - Le gate BET exige : proba modèle ≥ 65% (seuil utilisateur), EV ≥ 4% (marge de
 *    sécurité sur le devig) ET modèle calibré (rapport backtest).
 *  - Kelly fraction (cap 0.25 — convention PariScore, beads m13e/T2) pour la taille
 *    de mise : f* = (p*b - q)/b, b = odds-1, q = 1-p.
 */

/**
 * Dévig multiplicatif simple : normalise les probabilités implicites (1/odds)
 * pour que la somme fasse 1.
 * @param overround Somme des probas implicites (1/pHome + 1/pAway) — sinon calculée.
 */
export function devig(
  overroundOrOdds: number | { home: number; away: number },
  odds?: { home: number; away: number },
): { pHome: number; pAway: number } {
  const o =
    typeof overroundOrOdds === "number" && odds
      ? odds
      : (overroundOrOdds as { home: number; away: number });
  const ih = 1 / o.home;
  const ia = 1 / o.away;
  const sum = ih + ia;
  if (sum <= 0) return { pHome: 0.5, pAway: 0.5 };
  return { pHome: ih / sum, pAway: ia / sum };
}

/**
 * Expected value en % : (pModel × coteDécimale − 1) × 100.
 */
export function expectedValue(pModel: number, decimalOdds: number): number {
  return (pModel * decimalOdds - 1) * 100;
}

/**
 * Fraction de Kelly pleine, plafonnée à 0.25, bornée à 0 si EV ≤ 0.
 */
export function kellyFraction(pModel: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  if (b <= 0) return 0;
  const f = (pModel * b - (1 - pModel)) / b;
  if (f <= 0) return 0;
  return Math.min(f, 0.25);
}

export type BetVerdict = "BET" | "SKIP";

/**
 * Gate de verdict : proba ≥ 65% ET EV ≥ 4% ET modèle calibré.
 */
export function betVerdict(input: {
  pModel: number;
  decimalOdds: number;
  calibrated: boolean;
}): BetVerdict {
  if (!input.calibrated) return "SKIP";
  if (input.pModel < 0.65) return "SKIP";
  const ev = expectedValue(input.pModel, input.decimalOdds);
  if (ev < 4) return "SKIP";
  return "BET";
}