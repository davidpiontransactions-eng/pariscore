/**
 * cs2-calibration.ts — Métriques de calibration pour les probabilités prédictives CS2.
 * ---------------------------------------------------------------------------------
 * Justification académique (benchmark 2026-08-28) : la sélection d'un modèle sur la
 * calibration (Brier/ECE) produit un ROI bien supérieur à la sélection sur l'accuracy
 * (Walsh & Joshi, arXiv 2303.06021 : +34.69% vs −35.17%). Ces fonctions pures servent
 * de gate de calibration avant tout signal BET en production.
 */

export type CalibrationMetric = {
  brier: number;
  ece: number;
  roi: number;
  n: number;
};

export type CalibrationVerdict = "OK" | "NO-GO";

/**
 * Brier score moyen : MSE entre proba prédite et outcome binaire.
 * 0 = parfait, 0.25 = 50/50 non informatif, 1 = inversé.
 */
export function brierScore(probabilities: number[], outcomes: (0 | 1)[]): number {
  const n = Math.max(1, Math.min(probabilities.length, outcomes.length));
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = probabilities[i] - outcomes[i];
    acc += d * d;
  }
  return acc / n;
}

/**
 * Expected Calibration Error : moyenne pondérée |fréquence observée − proba moyenne|
 * par bin de probabilité. 0 = calibration parfaite.
 */
export function expectedCalibrationError(
  probabilities: number[],
  outcomes: (0 | 1)[],
  bins = 10,
): number {
  if (probabilities.length === 0 || probabilities.length !== outcomes.length) return 0;
  const width = 1 / bins;
  let acc = 0;
  let total = 0;
  for (let b = 0; b < bins; b++) {
    const lo = b * width;
    const hi = lo + width;
    const idxs: number[] = [];
    for (let i = 0; i < probabilities.length; i++) {
      const p = probabilities[i];
      // Dernier bin inclusif à 1.0
      if (p >= lo && (b === bins - 1 ? p <= hi : p < hi)) idxs.push(i);
    }
    if (idxs.length === 0) continue;
    let meanProb = 0;
    let freq = 0;
    for (const i of idxs) {
      meanProb += probabilities[i];
      freq += outcomes[i];
    }
    meanProb /= idxs.length;
    freq /= idxs.length;
    const contrib = Math.abs(freq - meanProb) * (idxs.length / probabilities.length);
    acc += contrib;
    total += idxs.length / probabilities.length;
  }
  return total > 0 ? acc : 0;
}

/**
 * Retour sur investissement (%, mise fixe 1u) : somme des gains nets divisée
 * par le nombre de paris. Cote décimale moyenne fournie par l'échantillon.
 */
export function roi(
  probabilities: number[],
  outcomes: (0 | 1)[],
  avgDecimalOdds: number,
): number {
  const n = Math.min(probabilities.length, outcomes.length);
  if (n === 0) return 0;
  let net = 0;
  for (let i = 0; i < n; i++) {
    net += outcomes[i] === 1 ? avgDecimalOdds - 1 : -1;
  }
  return (net / n) * 100;
}

/**
 * Verdict de calibration : OK si échantillon suffisant ET Brier raisonnable ET ECE faible.
 * Seuils documentés (benchmark académique 2026-08-28) — ajustables sur backtest réel.
 */
export function calibrationVerdict(metric: CalibrationMetric): CalibrationVerdict {
  if (metric.n < 30) return "NO-GO";
  if (metric.brier > 0.25) return "NO-GO";
  if (metric.ece > 0.1) return "NO-GO";
  return "OK";
}