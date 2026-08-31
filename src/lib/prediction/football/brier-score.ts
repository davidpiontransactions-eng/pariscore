/**
 * Métriques de calibration et d'évaluation des prédictions probabilistes.
 *
 * Brier score, log-loss, courbe de calibration et Ranked Probability Score (RPS).
 * Toutes les fonctions travaillent en probabilités 0-1 (pas en %).
 */

// ---------------------------------------------------------------------------
// Brier Score — moyenne quadratique des écarts probabilité / outcome binaire
// ---------------------------------------------------------------------------

/** Brier score : 0 = parfait, 1 = pire. Fonctionne pour un marché binaire (ex: BTTS, O2.5). */
export function brierScore(predicted: number[], actual: number[]): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return NaN;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    const p = clamp01(predicted[i]);
    const y = actual[i] === 1 ? 1 : 0;
    sum += (p - y) ** 2;
  }
  return sum / predicted.length;
}

// ---------------------------------------------------------------------------
// Log-Loss — pénalise fortement les prédictions confiantes mais fausses
// ---------------------------------------------------------------------------

/** Log-loss binaire : 0 = parfait, +∞ = pire. Epsilon évite log(0). */
export function logLoss(predicted: number[], actual: number[]): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return NaN;
  const eps = 1e-15;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predicted[i]));
    const y = actual[i] === 1 ? 1 : 0;
    sum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return sum / predicted.length;
}

// ---------------------------------------------------------------------------
// Courbe de calibration — regroupe les prédictions par bucket
// ---------------------------------------------------------------------------

export type CalibrationBin = {
  /** Centre du bucket (ex: 0.15 pour le bucket [0.1, 0.2]). */
  center: number;
  /** Probabilité moyenne prédite dans ce bucket. */
  meanPredicted: number;
  /** Fréquence réelle observée dans ce bucket. */
  observedFrequency: number;
  /** Nombre de prédictions dans ce bucket. */
  count: number;
};

/**
 * Courbe de calibration : découpe [0,1] en `bins` buckets, retourne la
 * fréquence observée vs la probabilité moyenne prédite par bucket.
 * Utile pour générer les données d'un graphique calibration.
 */
export function calibrationCurve(
  predicted: number[],
  actual: number[],
  bins: number = 10,
): CalibrationBin[] {
  if (predicted.length === 0 || predicted.length !== actual.length) return [];
  if (bins <= 0) return [];

  const bucketSize = 1 / bins;
  const buckets: { sumPred: number; sumActual: number; count: number }[] = [];
  for (let i = 0; i < bins; i++) buckets.push({ sumPred: 0, sumActual: 0, count: 0 });

  for (let i = 0; i < predicted.length; i++) {
    const p = clamp01(predicted[i]);
    const y = actual[i] === 1 ? 1 : 0;
    // Index du bucket, clamp pour p=1.0
    let idx = Math.floor(p / bucketSize);
    if (idx >= bins) idx = bins - 1;
    buckets[idx].sumPred += p;
    buckets[idx].sumActual += y;
    buckets[idx].count += 1;
  }

  const result: CalibrationBin[] = [];
  for (let i = 0; i < bins; i++) {
    const b = buckets[i];
    result.push({
      center: (i + 0.5) * bucketSize,
      meanPredicted: b.count > 0 ? b.sumPred / b.count : (i + 0.5) * bucketSize,
      observedFrequency: b.count > 0 ? b.sumActual / b.count : 0,
      count: b.count,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ranked Probability Score (RPS) — extension multiclasse du Brier score
// ---------------------------------------------------------------------------

/**
 * RPS pour un seul match : compare les CDF cumulées prédites vs l'outcome.
 *
 * `predicted[k]` = P(outcome ≤ k), `actual` = outcome observé (0, 1, 2, …).
 * Retourne un score 0 = parfait, 1 = pire.
 *
 * Usage typique : marché 1X2 (3 issues) → predicted = [P(1), P(1)+P(X), P(1)+P(X)+P(2)].
 */
function rpsSingle(predicted: number[], actual: number): number {
  if (predicted.length === 0 || !Number.isFinite(actual)) return NaN;
  const K = predicted.length;
  let sum = 0;
  for (let k = 0; k < K; k++) {
    const eik = actual <= k ? 1 : 0;
    sum += (predicted[k] - eik) ** 2;
  }
  // Normalisation : le max possible est K-1 (toute la masse sur la première issue)
  return sum / (K - 1 || 1);
}

/**
 * RPS moyen sur un ensemble de matchs.
 *
 * `predicted[i]` = tableau de CDF cumulées pour le match i.
 * `actual[i]` = outcome observé (index 0-based, ex: 0=victoire dom, 1=nul, 2=victoire ext).
 * Retourne un score 0 = parfait, 1 = pire.
 */
export function rankedProbabilityScore(
  predicted: number[][],
  actual: number[],
): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return NaN;
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    sum += rpsSingle(predicted[i], actual[i]);
  }
  return sum / predicted.length;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Accuracy binaire (seuil 0.5)
// ---------------------------------------------------------------------------

/** Taux de prédictions correctes (seuil = 0.5). Marché binaire uniquement. */
export function accuracy(predicted: number[], actual: number[]): number {
  if (predicted.length === 0 || predicted.length !== actual.length) return NaN;
  let correct = 0;
  for (let i = 0; i < predicted.length; i++) {
    const pred = predicted[i] >= 0.5 ? 1 : 0;
    const y = actual[i] === 1 ? 1 : 0;
    if (pred === y) correct++;
  }
  return correct / predicted.length;
}
