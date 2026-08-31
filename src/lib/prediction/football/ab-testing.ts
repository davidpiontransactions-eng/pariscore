/**
 * Service A/B testing pour comparer deux versions de modèles de prédiction.
 *
 * - Assignation déterministe par hash du matchId (même match → même variante)
 * - Comparaison via Brier score + test du chi-deux pour la significativité
 * - Métriques par marché : Brier, accuracy, log loss, sample size
 */

import type { PredictionLog } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketMetrics = {
  brierScore: number;
  accuracy: number;
  logLoss: number;
  sampleSize: number;
};

export type ComparisonResult = {
  winner: string | null;
  confidence: number;
  metricsA: MarketMetrics;
  metricsB: MarketMetrics;
  significant: boolean;
};

// ---------------------------------------------------------------------------
// Assignment déterministe — même matchId → toujours même variante
// ---------------------------------------------------------------------------

/**
 * Assigne une variante de manière déterministe basée sur le hash du matchId.
 * Un match donné recevra toujours la même variante, indépendamment de l'appel.
 */
export function assignVariant(matchId: string, variants: string[]): string {
  if (variants.length === 0) {
    throw new Error("Au moins une variante requise");
  }
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    const ch = matchId.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const idx = Math.abs(hash) % variants.length;
  return variants[idx];
}

// ---------------------------------------------------------------------------
// Métriques par marché (Brier, accuracy, log loss)
// ---------------------------------------------------------------------------

/**
 * Calcule le Brier score moyen pour un ensemble de logs.
 */
function computeBrier(logs: PredictionLog[]): number {
  let sum = 0;
  let count = 0;

  for (const log of logs) {
    if (!log.settled || log.actualHome === null || log.actualAway === null) continue;

    const outcomeHome = log.actualHome > log.actualAway ? 1 : 0;
    const outcomeDraw = log.actualHome === log.actualAway ? 1 : 0;
    const outcomeAway = log.actualHome < log.actualAway ? 1 : 0;

    const brierHome = (log.homeProb - outcomeHome) ** 2;
    const brierDraw = (log.drawProb - outcomeDraw) ** 2;
    const brierAway = (log.awayProb - outcomeAway) ** 2;

    sum += (brierHome + brierDraw + brierAway) / 3;
    count++;
  }

  return count === 0 ? NaN : sum / count;
}

/**
 * Calcule l'accuracy (probabilité la plus élevée == outcome réel).
 */
function computeAccuracy(logs: PredictionLog[]): number {
  let correct = 0;
  let count = 0;

  for (const log of logs) {
    if (!log.settled || log.actualHome === null || log.actualAway === null) continue;

    const outcomeHome = log.actualHome > log.actualAway ? 1 : 0;
    const outcomeDraw = log.actualHome === log.actualAway ? 1 : 0;
    const outcomeAway = log.actualHome < log.actualAway ? 1 : 0;

    const predicted = [log.homeProb, log.drawProb, log.awayProb];
    const actual = [outcomeHome, outcomeDraw, outcomeAway];

    const maxPredIdx = predicted.indexOf(Math.max(...predicted));
    const maxActualIdx = actual.indexOf(Math.max(...actual));

    if (maxPredIdx === maxActualIdx) correct++;
    count++;
  }

  return count === 0 ? NaN : correct / count;
}

/**
 * Calcule le log loss moyen.
 */
function computeLogLoss(logs: PredictionLog[]): number {
  const EPS = 1e-10;
  let sum = 0;
  let count = 0;

  for (const log of logs) {
    if (!log.settled || log.actualHome === null || log.actualAway === null) continue;

    const outcomeHome = log.actualHome > log.actualAway ? 1 : 0;
    const outcomeDraw = log.actualHome === log.actualAway ? 1 : 0;
    const outcomeAway = log.actualHome < log.actualAway ? 1 : 0;

    const ll =
      -outcomeHome * Math.log(Math.max(log.homeProb, EPS)) -
      outcomeDraw * Math.log(Math.max(log.drawProb, EPS)) -
      outcomeAway * Math.log(Math.max(log.awayProb, EPS));

    sum += ll;
    count++;
  }

  return count === 0 ? NaN : sum / count;
}

/**
 * Calcule toutes les métriques pour un ensemble de logs.
 */
function computeMetrics(logs: PredictionLog[]): MarketMetrics {
  const settled = logs.filter(
    (l) => l.settled && l.actualHome !== null && l.actualAway !== null,
  );

  return {
    brierScore: round4(computeBrier(settled)),
    accuracy: round4(computeAccuracy(settled)),
    logLoss: round4(computeLogLoss(settled)),
    sampleSize: settled.length,
  };
}

// ---------------------------------------------------------------------------
// Test du chi-deux pour significativité statistique
// ---------------------------------------------------------------------------

/**
 * Calcule la fonction gamma incomplète (approximation pour chi-deux df=1).
 * Utilise la série de Taylor tronquée (assez pour des valeurs courantes).
 *
 * P(X > x) pour X ~ chi2(1) — test bilatéral simplifié.
 */
function chi2PValue(df: number, x: number): number {
  if (x <= 0) return 1;

  // Approximation via la loi normale pour df pair
  // Pour df=1, chi2 = Z^2, donc p = 2 * (1 - Phi(sqrt(x)))
  if (df === 1) {
    const z = Math.sqrt(x);
    return 2 * (1 - normalCDF(z));
  }

  // Pour df >= 2, approximation par Wilson-Hilferty
  const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
  const denom = Math.sqrt(2 / (9 * df));
  return 1 - normalCDF(z / denom);
}

/**
 * Approximation de la fonction de répartition normale (CDF).
 * Utilise l'approximation de Abramowitz & Stegun.
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1 + sign * y);
}

/**
 * Effectue un test du chi-deux sur les résultats de deux modèles.
 *
 * Contingence :
 *   - Correct (prédiction == outcome)
 *   - Incorrect (prédiction != outcome)
 *
 * Retourne la p-value (seuil de significativité : p < 0.05).
 */
function chiSquaredTest(
  correctA: number,
  totalA: number,
  correctB: number,
  totalB: number,
): number {
  // Table de contingence 2×2
  const incorrectA = totalA - correctA;
  const incorrectB = totalB - correctB;

  const n = totalA + totalB;
  if (n === 0) return 1;

  const rowCorrect = correctA + correctB;
  const rowIncorrect = incorrectA + incorrectB;

  let chi2 = 0;

  // Chaque cellule contribute (O - E)² / E
  const cells = [
    { obs: correctA, exp: (rowCorrect * totalA) / n },
    { obs: incorrectA, exp: (rowIncorrect * totalA) / n },
    { obs: correctB, exp: (rowCorrect * totalB) / n },
    { obs: incorrectB, exp: (rowIncorrect * totalB) / n },
  ];

  for (const cell of cells) {
    if (cell.exp === 0) continue;
    chi2 += (cell.obs - cell.exp) ** 2 / cell.exp;
  }

  // df = (2-1) * (2-1) = 1
  return chi2PValue(1, chi2);
}

// ---------------------------------------------------------------------------
// Fonction principale de comparaison A/B
// ---------------------------------------------------------------------------

/**
 * Compare deux ensembles de prédictions (variante A vs B) sur les mêmes matchs.
 *
 * @param resultsA - logs du modèle A
 * @param resultsB - logs du modèle B
 * @returns Résultat de comparaison avec gagnant, confiance, métriques
 */
export function compareVariants(
  resultsA: PredictionLog[],
  resultsB: PredictionLog[],
): ComparisonResult {
  const metricsA = computeMetrics(resultsA);
  const metricsB = computeMetrics(resultsB);

  // Calcul des accuracy pour le test chi-deux
  const settledA = resultsA.filter(
    (l) => l.settled && l.actualHome !== null && l.actualAway !== null,
  );
  const settledB = resultsB.filter(
    (l) => l.settled && l.actualHome !== null && l.actualAway !== null,
  );

  const correctA = countCorrect(settledA);
  const correctB = countCorrect(settledB);

  // Test de significativité
  const pValue = chiSquaredTest(correctA, settledA.length, correctB, settledB.length);
  const significant = pValue < 0.05;

  // Détermination du gagnant
  let winner: string | null = null;
  if (significant) {
    // Gagnant = celui avec le Brier score le plus bas (meilleur)
    if (metricsA.brierScore < metricsB.brierScore) {
      winner = "A";
    } else if (metricsB.brierScore < metricsA.brierScore) {
      winner = "B";
    }
  }

  // Confiance = 1 - p-value (en pourcentage)
  const confidence = round4((1 - pValue) * 100);

  return {
    winner,
    confidence,
    metricsA,
    metricsB,
    significant,
  };
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function countCorrect(logs: PredictionLog[]): number {
  let correct = 0;
  for (const log of logs) {
    if (log.actualHome === null || log.actualAway === null) continue;
    const outcomeHome = log.actualHome > log.actualAway ? 1 : 0;
    const outcomeDraw = log.actualHome === log.actualAway ? 1 : 0;
    const outcomeAway = log.actualHome < log.actualAway ? 1 : 0;

    const predicted = [log.homeProb, log.drawProb, log.awayProb];
    const actual = [outcomeHome, outcomeDraw, outcomeAway];

    const maxPredIdx = predicted.indexOf(Math.max(...predicted));
    const maxActualIdx = actual.indexOf(Math.max(...actual));

    if (maxPredIdx === maxActualIdx) correct++;
  }
  return correct;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
