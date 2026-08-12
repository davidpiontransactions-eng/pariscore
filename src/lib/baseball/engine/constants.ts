/**
 * Constantes du moteur sabermétrique.
 * Matrice d'espérance de points MLB 2010-2015 (moyennes publiées) —
 * 24 états : 8 configurations de bases × 3 nombres d'outs.
 */

/** Espérance de points par état [bases 0..7][outs 0..2]. */
export const RUN_EXPECTANCY_MATRIX: ReadonlyArray<ReadonlyArray<number>> = [
  [0.461, 0.243, 0.095], // ———
  [0.831, 0.489, 0.214], // 1——
  [1.068, 0.644, 0.305], // -2-
  [1.373, 0.908, 0.343], // --3
  [1.378, 0.876, 0.384], // 12-
  [1.795, 1.144, 0.451], // 1-3
  [1.92, 1.353, 0.478], // -23
  [2.282, 1.52, 0.692], // 123
];

/** Moyennes de ligue MLB (référence OPS 0.706). */
export const LG_OPS = 0.706;
export const LG_K9 = 8.6;
export const LG_BB9 = 3.1;
export const LG_HR9 = 1.14;
export const LG_H9 = 8.2;
export const LG_RUNS_PER_INNING = 0.488;
export const LG_PA_PER_INNING = 4.35;
export const LG_BULLPEN_ERA = 3.9;

/** Exposant de la loi de Bill James (optimisation historique). */
export const PYTHAGOREAN_EXPONENT = 1.83;

/** Seuil de confiance requis pour émettre une recommandation O/U. */
export const CONFIDENCE_THRESHOLD = 0.65;

/** Version du modèle — incrémentée à chaque changement de formule. */
export const MODEL_VERSION = "sabermetric-2.1";

/** Événements d'un passage au bâton simulé. */
export type PaKind =
  | "strikeout"
  | "walk"
  | "single"
  | "double"
  | "triple"
  | "homerun"
  | "groundout"
  | "doubleplay";

export interface BatterProfile {
  pStrikeout: number;
  pWalk: number;
  pSingle: number;
  pDouble: number;
  pTriple: number;
  pHomerun: number;
  pOut: number;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
