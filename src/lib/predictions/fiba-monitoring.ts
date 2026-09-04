/**
 * Monitoring et tracking de la performance du modèle FIBA.
 * 
 * Ce module:
 * - Enregistre chaque prédiction
 * - Compare aux résultats réels
 * - Calcule les métriques en temps réel
 * - Alertes si performance dégrade
 */

import type { HybridPrediction } from "./fiba-predictions";

export type PredictionRecord = {
  id: string;
  matchId: string;
  timestamp: string;
  homeTeam: string;
  awayTeam: string;
  prediction: HybridPrediction;
  actualResult: "HOME_WIN" | "AWAY_WIN" | null; // null = pas encore joué
  isCorrect: boolean | null;
};

export type MonitoringMetrics = {
  totalPredictions: number;
  resolvedPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  avgEdge: number;
  last24h: {
    total: number;
    correct: number;
    accuracy: number;
  };
  byModel: {
    elo: { correct: number; total: number; accuracy: number };
    fourFactors: { correct: number; total: number; accuracy: number };
    xgboost: { correct: number; total: number; accuracy: number };
    hybrid: { correct: number; total: number; accuracy: number };
  };
  alerts: string[];
};

// En production: store en base (Prisma)
const predictionStore: PredictionRecord[] = [];

/**
 * Enregistre une prédiction.
 */
export function recordPrediction(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  prediction: HybridPrediction,
): PredictionRecord {
  const record: PredictionRecord = {
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    matchId,
    timestamp: new Date().toISOString(),
    homeTeam,
    awayTeam,
    prediction,
    actualResult: null,
    isCorrect: null,
  };

  predictionStore.push(record);
  
  // En production: prisma.prediction.create({ data: record })
  
  return record;
}

/**
 * Met à jour le résultat réel d'un match.
 */
export function updateResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
): PredictionRecord | null {
  const record = predictionStore.find((r) => r.matchId === matchId);
  if (!record) return null;

  const actualResult = homeScore > awayScore ? "HOME_WIN" : "AWAY_WIN";
  const predictedHomeWin = record.prediction.blendedPHome > 0.5;
  const actualHomeWin = actualResult === "HOME_WIN";
  
  record.actualResult = actualResult;
  record.isCorrect = predictedHomeWin === actualHomeWin;

  // En production: prisma.prediction.update({ where: { id: record.id }, data: record })
  
  return record;
}

/**
 * Calcule les métriques de monitoring.
 */
export function getMonitoringMetrics(): MonitoringMetrics {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const resolved = predictionStore.filter((r) => r.actualResult !== null);
  const correct = resolved.filter((r) => r.isCorrect === true);
  
  const last24hPredictions = predictionStore.filter(
    (r) => new Date(r.timestamp) > last24h,
  );
  const last24hResolved = last24hPredictions.filter((r) => r.actualResult !== null);
  const last24hCorrect = last24hResolved.filter((r) => r.isCorrect === true);

  // Calculer les métriques par modèle
  const byModel = {
    elo: calculateModelMetrics(resolved, (r) => r.prediction.elo.pHome > 0.5),
    fourFactors: calculateModelMetrics(resolved, (r) => r.prediction.fourFactors.pHome > 0.5),
    xgboost: calculateModelMetrics(resolved, (r) => r.prediction.xgboost.pHome > 0.5),
    hybrid: calculateModelMetrics(resolved, (r) => r.prediction.blendedPHome > 0.5),
  };

  // Alertes
  const alerts: string[] = [];
  
  if (resolved.length >= 10) {
    const recentAccuracy = last24hResolved.length > 0
      ? last24hCorrect.length / last24hResolved.length
      : 0;
    
    if (recentAccuracy < 0.5) {
      alerts.push(`⚠️ Accuracy basse les dernières 24h: ${(recentAccuracy * 100).toFixed(1)}%`);
    }
    
    if (recentAccuracy > 0.8) {
      alerts.push(`🎯 Excellente performance: ${(recentAccuracy * 100).toFixed(1)}%`);
    }
  }

  return {
    totalPredictions: predictionStore.length,
    resolvedPredictions: resolved.length,
    correctPredictions: correct.length,
    accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
    avgConfidence: calculateAvgConfidence(resolved),
    avgEdge: calculateAvgEdge(resolved),
    last24h: {
      total: last24hPredictions.length,
      correct: last24hCorrect.length,
      accuracy: last24hResolved.length > 0 ? last24hCorrect.length / last24hResolved.length : 0,
    },
    byModel,
    alerts,
  };
}

function calculateModelMetrics(
  records: PredictionRecord[],
  isCorrectFn: (r: PredictionRecord) => boolean,
): { correct: number; total: number; accuracy: number } {
  const total = records.length;
  const correct = records.filter(isCorrectFn).length;
  return {
    correct,
    total,
    accuracy: total > 0 ? correct / total : 0,
  };
}

function calculateAvgConfidence(records: PredictionRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, r) => sum + r.prediction.blendedConfidence, 0) / records.length;
}

function calculateAvgEdge(records: PredictionRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, r) => sum + Math.abs(r.prediction.edge), 0) / records.length;
}

/**
 * Rapport de performance pour le dashboard.
 */
export function getPerformanceReport(): string {
  const metrics = getMonitoringMetrics();
  
  return `
📊 FIBA Prediction Model Performance
====================================

Total Predictions: ${metrics.totalPredictions}
Resolved: ${metrics.resolvedPredictions}
Correct: ${metrics.correctPredictions}
Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%

Avg Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%
Avg Edge: ${(metrics.avgEdge * 100).toFixed(1)}%

Last 24h:
  - Predictions: ${metrics.last24h.total}
  - Correct: ${metrics.last24h.correct}
  - Accuracy: ${(metrics.last24h.accuracy * 100).toFixed(1)}%

By Model:
  - Elo: ${(metrics.byModel.elo.accuracy * 100).toFixed(1)}%
  - Four Factors: ${(metrics.byModel.fourFactors.accuracy * 100).toFixed(1)}%
  - XGBoost: ${(metrics.byModel.xgboost.accuracy * 100).toFixed(1)}%
  - Hybrid: ${(metrics.byModel.hybrid.accuracy * 100).toFixed(1)}%

${metrics.alerts.length > 0 ? "\nAlerts:\n" + metrics.alerts.join("\n") : ""}
`;
}
