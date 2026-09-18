/**
 * Bayesian Live Blend — combine modèle et marché.
 *
 * Poids dynamique : au début du match, le marché est plus fiable
 * (il agrège l'information de milliers de parieurs). En fin de match,
 * le modèle Markov est plus précis (il connaît le score exact).
 *
 * Formule : P(blended) = w·P(modèle) + (1−w)·P(marché)
 * où w = f(progression du match) ∈ [0, 1]
 *
 * Référence : Wang 2026, "Dynamic ensemble weighting for live tennis
 * prediction", Section 4.2 — Bayesian model averaging.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Source de probabilité. */
export type ProbSource = {
  /** Probabilité estimée [0-1]. */
  prob: number;
  /** Confiance dans cette estimation [0-1]. */
  confidence: number;
  /** Type de source. */
  type: "model" | "market";
};

/** Contexte live pour le blending. */
export type BlendContext = {
  /** Progression du match [0-1] (0=début, 1=fin). */
  matchProgress: number;
  /** Probabilité du modèle Markov [0-1]. */
  modelProb: number;
  /** Confiance du modèle [0-1]. */
  modelConfidence: number;
  /** Probabilité implicite du marché [0-1]. */
  marketProb: number;
  /** Confiance du marché [0-1]. */
  marketConfidence: number;
};

/** Résultat du blending. */
export type BlendResult = {
  /** Probabilité blendée [0-1]. */
  prob: number;
  /** Poids du modèle [0-1]. */
  modelWeight: number;
  /** Poids du marché [0-1]. */
  marketWeight: number;
  /** Source dominante. */
  dominant: "model" | "market" | "balanced";
};

// ---------------------------------------------------------------------------
// Fonction de blending
// ---------------------------------------------------------------------------

/**
 * Poids du modèle en fonction de la progression du match.
 *
 * Début (progress=0) : marché domine (w≈0.2)
 * Milieu (progress=0.5) : équilibre (w≈0.5)
 * Fin (progress=1) : modèle domine (w≈0.9)
 *
 * Forme : sigmoïde ajustée
 */
function modelWeightFromProgress(progress: number): number {
  // Sigmoïde centrée à 0.5, pente ajustée pour tennis
  // w = 1 / (1 + exp(-k*(progress - 0.5)))
  // k=6 donne : w(0)=0.07, w(0.5)=0.5, w(1)=0.93
  const k = 6;
  return 1 / (1 + Math.exp(-k * (progress - 0.5)));
}

/**
 * Blend bayésien de deux sources de probabilité.
 *
 * @param ctx - Contexte live
 * @returns Probabilité blendée et métadonnées
 */
export function bayesianBlend(ctx: BlendContext): BlendResult {
  const { matchProgress, modelProb, modelConfidence, marketProb, marketConfidence } = ctx;

  // Poids de base selon la progression
  let w = modelWeightFromProgress(matchProgress);

  // Ajustement par la confiance relative
  // Si le modèle est très confiant et le marché peu → augmenter w
  const confidenceRatio = modelConfidence / Math.max(marketConfidence, 0.01);
  w = w * Math.min(confidenceRatio, 2); // borné à 2×
  w = Math.max(0.05, Math.min(0.95, w)); // clamp [0.05, 0.95]

  // Normalisation
  const totalWeight = w + (1 - w);
  const normalizedModelWeight = w / totalWeight;
  const normalizedMarketWeight = (1 - w) / totalWeight;

  // Probabilité blendée
  const prob = normalizedModelWeight * modelProb + normalizedMarketWeight * marketProb;

  // Source dominante
  let dominant: "model" | "market" | "balanced";
  if (normalizedModelWeight > 0.65) dominant = "model";
  else if (normalizedMarketWeight > 0.65) dominant = "market";
  else dominant = "balanced";

  return {
    prob: Math.max(0, Math.min(1, prob)),
    modelWeight: normalizedModelWeight,
    marketWeight: normalizedMarketWeight,
    dominant,
  };
}

/**
 * Blend de N sources de probabilité.
 *
 * @param sources - Liste des sources avec probabilité et confiance
 * @param matchProgress - Progression du match [0-1]
 * @returns Probabilité blendée
 */
export function blendMultiple(
  sources: ProbSource[],
  matchProgress: number,
): number {
  if (sources.length === 0) return 0.5;
  if (sources.length === 1) return sources[0].prob;

  // Pondération par confiance × poids progression
  let totalWeight = 0;
  let weightedSum = 0;

  for (const source of sources) {
    let weight = source.confidence;

    // Ajuster selon le type et la progression
    if (source.type === "model") {
      weight *= modelWeightFromProgress(matchProgress);
    } else {
      weight *= (1 - modelWeightFromProgress(matchProgress));
    }

    weightedSum += source.prob * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Conversion d'une cote décimale en probabilité implicite.
 *
 * @param decimalOdd - Cote décimale (ex: 2.50)
 * @returns Probabilité implicite [0-1]
 */
export function oddToProb(decimalOdd: number): number {
  if (decimalOdd <= 1) return 1;
  return 1 / decimalOdd;
}

/**
 * Conversion d'une probabilité en cote décimale.
 *
 * @param prob - Probabilité [0-1]
 * @returns Cote décimale
 */
export function probToOdd(prob: number): number {
  if (prob <= 0) return Infinity;
  return 1 / prob;
}

/**
 * De-vig : calcule les probabilités "justes" à partir des cotes du bookmaker.
 *
 * Le bookmaker ajoute une marge (vig) qui fait que la somme des probabilités
 * implicites dépasse 100%. De-vig normalise pour obtenir les probabilités
 * "vraies" sans marge.
 *
 * @param probs - Probabilités implicites des cotes [probA, probB]
 * @returns Probabilités normalisées [probA, probB] sommant à 1
 */
export function deVig(probs: [number, number]): [number, number] {
  const total = probs[0] + probs[1];
  if (total === 0) return [0.5, 0.5];
  return [probs[0] / total, probs[1] / total];
}

/**
 * Calcule le edge (avantage) par rapport au marché.
 *
 * @param modelProb - Probabilité du modèle [0-1]
 * @param marketProb - Probabilité implicite du marché [0-1]
 * @returns Edge en pourcentage (positif = value bet)
 */
export function computeEdge(modelProb: number, marketProb: number): number {
  return (modelProb - marketProb) * 100;
}

/**
 * Kelly Criterion : fraction optimale du bankroll à miser.
 *
 * @param modelProb - Probabilité estimée [0-1]
 * @param odds - Cote décimale
 * @returns Fraction du bankroll [0-1] (0 si pas de value)
 */
export function kellyFraction(modelProb: number, odds: number): number {
  const b = odds - 1; // gain net
  const p = modelProb;
  const q = 1 - p;
  const fraction = (b * p - q) / b;
  return Math.max(0, fraction);
}
