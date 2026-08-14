import type { FootballMatch } from "@/lib/football-data";

/**
 * Utilitaires de score des « picks » de pronostic pour l'onglet Football.
 *
 * Un pick est une option multi-jambes forte (>75%). On définit un score
 * monotone pour classer les matchs et en extraire le Banker / le Match du jour.
 */

export type PickLeg = { leg: string; prob: number };

/** Meilleure probabilité multi-jambes d'un match (DC, O/U, BTTS, corners). */
export function pickScore(match: FootballMatch): number {
  const p = match.prediction;
  return Math.max(
    p.doubleChance?.prob ?? 0,
    p.over15Prob ?? 0,
    p.under35Prob ?? 0,
    p.bttsProb ?? 0,
    p.bestCornerOver?.overProb ?? 0,
  );
}

/** Libellé + probabilité du pick le plus fort du match (null si aucun). */
export function pickLabel(match: FootballMatch): PickLeg | null {
  const p = match.prediction;
  const candidates: PickLeg[] = [];
  if (p.doubleChance) candidates.push({ leg: `Double chance ${p.doubleChance.selection}`, prob: p.doubleChance.prob });
  if (p.over15Prob != null) candidates.push({ leg: "Plus de 1.5 buts", prob: p.over15Prob });
  if (p.under35Prob != null) candidates.push({ leg: "Moins de 3.5 buts", prob: p.under35Prob });
  if (p.bttsProb > 0) candidates.push({ leg: "Les deux marquent (BTTS)", prob: p.bttsProb });
  if (p.bestCornerOver) candidates.push({ leg: `Plus de ${p.bestCornerOver.line} corners`, prob: p.bestCornerOver.overProb });
  candidates.sort((a, b) => b.prob - a.prob);
  return candidates[0] ?? null;
}

/**
 * Confiance modèle (0–1) dérivée du pick : 0.65 minimum quand un pick fort
 * existe, sinon on attend 3+ garde de marge. Miroir du calcul du match card.
 */
export function pickConfidence(prob: number): number {
  return 0.5 + (prob / 100) * 0.3;
}

/** Périmètre de confiance : un pick « fort » est ≥ 72 %. */
export const STRONG_PICK_THRESHOLD = 72;