/**
 * Écart de valeur entre le modèle et le marché, pour un marché live.
 *
 * Isolé du composant et du moteur : c'est la seule partie de ce calcul qui mérite un
 * test, parce que c'est la seule qui puisse produire un nombre absurde. Le reste est de
 * l'affichage.
 *
 * ## Pourquoi ce module existe
 *
 * Le contrat `LiveBetsBundle` exprime les probabilités en **fraction** [0, 1]
 * (`LIVE_PROB_MIN = 0.02`, `LIVE_PROB_MAX = 0.98`). Un écart calculé
 * directement sur ces fractions donne `0.69 − 0.48 = 0.21` : arrondi en points,
 * il vaille toujours 0 ou 1. L'échelle est donc normalisée ici, une fois, et le
 * résultat est garanti dans [-100, +100].
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne calcule **pas** un EV. Un EV exige l'espérance de gain nette
 * (`p_modele × (cote × stakes − 1) − (1 − p_modele) × stakes`), qui dépend de la
 * gestion de mise et de la marge du bookmaker. Ici on compare deux
 * probabilités, ce qui est une indication d'écart et rien de plus.
 */

/** Cote décimale minimale plausible. 1.01 = « pas de marché » en pratique. */
const MIN_ODD = 1.01;

export type ValueEdge = {
  /** Probabilité modèle, en pourcentage entier [0, 100]. */
  modelPct: number;
  /** Probabilité marché, en pourcentage entier [0, 100]. `null` si cote absente. */
  marketPct: number | null;
  /**
   * Écart modèle − marché, en points entiers. `null` quand le marché est inconnu —
   * on ne fabrique pas de référence pour comparer.
   */
  edgePts: number | null;
  /** Vrai si l'écart est assez large pour être affiché (filtre le bruit ±1). */
  meaningful: boolean;
};

/** Normalise une probabilité en pourcentage, quelle que soit l'échelle reçue. */
export function toPercent(prob: number): number {
  if (!Number.isFinite(prob)) return 0;
  // Le contrat est en fraction [0, 1]. Une valeur > 1 ne peut pas être une
  // probabilité : on la borne plutôt que de la multiplier par 100, ce qui
  // produirait un « 6900 % » — exactement l'artefact que ce module existe
  // pour empêcher.
  const pct = prob > 1 ? prob : prob * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Probabilité marché implicite d'une cote décimale, en pourcentage. */
export function impliedPercent(odd: number): number {
  if (!Number.isFinite(odd) || odd < MIN_ODD) return 0;
  return Math.max(0, Math.min(100, Math.round(100 / odd)));
}

/**
 * Calcule l'écart modèle/marché d'une issue.
 *
 * @param modelProb Probabilité modèle, dans l'échelle du contrat (fraction [0, 1]).
 * @param marketOdd Cote décimale du marché. `null`/absente → pas d'écart.
 * @param minEdgePoints Écart minimal pour `meaningful`. Un écart de 1-2 points
 *   est du bruit d'arrondi, pas une opportunité.
 */
export function computeValueEdge(
  modelProb: number,
  marketOdd: number | null | undefined,
  minEdgePoints = 3,
): ValueEdge {
  const modelPct = toPercent(modelProb);
  const marketPct = marketOdd != null ? impliedPercent(marketOdd) : null;
  if (marketPct == null) {
    return { modelPct, marketPct: null, edgePts: null, meaningful: false };
  }
  const raw = modelPct - marketPct;
  // Borné : deux pourcentages dans [0, 100] ne peuvent pas s'écarter de plus
  // de 100, mais l'arrondi est fait après soustraction — on borne quand même
  // pour que le type reste sûr même si un appelant passe une valeur hors contrat.
  const edgePts = Math.max(-100, Math.min(100, Math.round(raw)));
  return { modelPct, marketPct, edgePts, meaningful: Math.abs(edgePts) >= minEdgePoints };
}