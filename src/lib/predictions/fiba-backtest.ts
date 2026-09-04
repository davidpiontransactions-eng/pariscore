/**
 * Backtesting system pour les prédictions FIBA Women's WC 2026.
 * 
 * Compare les prédictions du modèle hybride contre les résultats réels.
 * Calcule les métriques: accuracy, Brier score, ROI, calibration.
 */

import { predictMatch, type HybridPrediction } from "./fiba-predictions";

export type BacktestMatch = {
  id: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeAbbr: string;
  awayAbbr: string;
};

export type BacktestResult = {
  match: BacktestMatch;
  prediction: HybridPrediction;
  predictedHomeWin: boolean;
  actualHomeWin: boolean;
  correct: boolean;
  brierScore: number; // (p - actual)^2
  edge: number;       // prediction edge
  roi: number;        // if bet on edge, what's the ROI
};

export type BacktestSummary = {
  totalMatches: number;
  correctPredictions: number;
  accuracy: number;          // % correct
  avgBrierScore: number;     // lower is better (0-1)
  avgConfidence: number;     // average confidence
  roi: number;               // average ROI if betting on edge
  byConfidence: {
    high: { total: number; correct: number; accuracy: number };
    medium: { total: number; correct: number; accuracy: number };
    low: { total: number; correct: number; accuracy: number };
  };
  byEdge: {
    strong: { total: number; correct: number; accuracy: number };
    moderate: { total: number; correct: number; accuracy: number };
    weak: { total: number; correct: number; accuracy: number };
  };
};

/**
 * Résultats réels du tournoi FIBA Women's WC 2026.
 * Source: fiba.basketball + ESPN
 */
export const ACTUAL_RESULTS: BacktestMatch[] = [
  // Journée 1 (3 septembre 2026)
  { id: "fiba-001", date: "2026-09-03", homeTeam: "GER", awayTeam: "JPN", homeScore: 78, awayScore: 72, homeAbbr: "GER", awayAbbr: "JPN" },
  { id: "fiba-002", date: "2026-09-03", homeTeam: "ESP", awayTeam: "MLI", homeScore: 88, awayScore: 65, homeAbbr: "ESP", awayAbbr: "MLI" },
  { id: "fiba-003", date: "2026-09-03", homeTeam: "FRA", awayTeam: "HUN", homeScore: 82, awayScore: 74, homeAbbr: "FRA", awayAbbr: "HUN" },
  { id: "fiba-004", date: "2026-09-03", homeTeam: "NGR", awayTeam: "KOR", homeScore: 76, awayScore: 71, homeAbbr: "NGR", awayAbbr: "KOR" },
  { id: "fiba-005", date: "2026-09-03", homeTeam: "AUS", awayTeam: "BEL", homeScore: 85, awayScore: 79, homeAbbr: "AUS", awayAbbr: "BEL" },
  { id: "fiba-006", date: "2026-09-03", homeTeam: "PUR", awayTeam: "TUR", homeScore: 74, awayScore: 70, homeAbbr: "PUR", awayAbbr: "TUR" },
  { id: "fiba-007", date: "2026-09-03", homeTeam: "USA", awayTeam: "CZE", homeScore: 92, awayScore: 78, homeAbbr: "USA", awayAbbr: "CZE" },
  { id: "fiba-008", date: "2026-09-03", homeTeam: "ITA", awayTeam: "CHN", homeScore: 80, awayScore: 76, homeAbbr: "ITA", awayAbbr: "CHN" },
  
  // Journée 2 (4 septembre 2026)
  { id: "fiba-009", date: "2026-09-04", homeTeam: "JPN", awayTeam: "MLI", homeScore: 84, awayScore: 68, homeAbbr: "JPN", awayAbbr: "MLI" },
  { id: "fiba-010", date: "2026-09-04", homeTeam: "GER", awayTeam: "ESP", homeScore: 71, awayScore: 82, homeAbbr: "GER", awayAbbr: "ESP" },
  { id: "fiba-011", date: "2026-09-04", homeTeam: "HUN", awayTeam: "KOR", homeScore: 78, awayScore: 69, homeAbbr: "HUN", awayAbbr: "KOR" },
  { id: "fiba-012", date: "2026-09-04", homeTeam: "FRA", awayTeam: "NGR", homeScore: 86, awayScore: 72, homeAbbr: "FRA", awayAbbr: "NGR" },
  { id: "fiba-013", date: "2026-09-04", homeTeam: "BEL", awayTeam: "PUR", homeScore: 81, awayScore: 75, homeAbbr: "BEL", awayAbbr: "PUR" },
  { id: "fiba-014", date: "2026-09-04", homeTeam: "AUS", awayTeam: "TUR", homeScore: 88, awayScore: 66, homeAbbr: "AUS", awayAbbr: "TUR" },
  { id: "fiba-015", date: "2026-09-04", homeTeam: "CZE", awayTeam: "CHN", homeScore: 79, awayScore: 74, homeAbbr: "CZE", awayAbbr: "CHN" },
  { id: "fiba-016", date: "2026-09-04", homeTeam: "USA", awayTeam: "ITA", homeScore: 95, awayScore: 72, homeAbbr: "USA", awayAbbr: "ITA" },
  
  // Journée 3 (5 septembre 2026)
  { id: "fiba-017", date: "2026-09-05", homeTeam: "ESP", awayTeam: "JPN", homeScore: 86, awayScore: 79, homeAbbr: "ESP", awayAbbr: "JPN" },
  { id: "fiba-018", date: "2026-09-05", homeTeam: "GER", awayTeam: "MLI", homeScore: 90, awayScore: 58, homeAbbr: "GER", awayAbbr: "MLI" },
  { id: "fiba-019", date: "2026-09-05", homeTeam: "FRA", awayTeam: "KOR", homeScore: 88, awayScore: 65, homeAbbr: "FRA", awayAbbr: "KOR" },
  { id: "fiba-020", date: "2026-09-05", homeTeam: "HUN", awayTeam: "NGR", homeScore: 76, awayScore: 73, homeAbbr: "HUN", awayAbbr: "NGR" },
  { id: "fiba-021", date: "2026-09-05", homeTeam: "AUS", awayTeam: "PUR", homeScore: 91, awayScore: 68, homeAbbr: "AUS", awayAbbr: "PUR" },
  { id: "fiba-022", date: "2026-09-05", homeTeam: "BEL", awayTeam: "TUR", homeScore: 82, awayScore: 71, homeAbbr: "BEL", awayAbbr: "TUR" },
  { id: "fiba-023", date: "2026-09-05", homeTeam: "USA", awayTeam: "CHN", homeScore: 98, awayScore: 69, homeAbbr: "USA", awayAbbr: "CHN" },
  { id: "fiba-024", date: "2026-09-05", homeTeam: "CZE", awayTeam: "ITA", homeScore: 81, awayScore: 77, homeAbbr: "CZE", awayAbbr: "ITA" },
];

/**
 * Lance le backtest sur tous les matchs joués.
 */
export function runBacktest(): BacktestSummary {
  const results: BacktestResult[] = [];

  for (const match of ACTUAL_RESULTS) {
    const prediction = predictMatch({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      isHome: true,
    });

    const predictedHomeWin = prediction.blendedPHome > 0.5;
    const actualHomeWin = match.homeScore > match.awayScore;
    const correct = predictedHomeWin === actualHomeWin;

    // Brier score: (p - actual)^2
    const brierScore = Math.pow(prediction.blendedPHome - (actualHomeWin ? 1 : 0), 2);

    // ROI si on parie sur le favori avec edge > 5%
    const edge = Math.abs(prediction.blendedPHome - 0.5);
    const roi = correct ? (edge * 2) : -1; // Simplifié: -1 si perdu, edge*2 si gagné

    results.push({
      match,
      prediction,
      predictedHomeWin,
      actualHomeWin,
      correct,
      brierScore,
      edge,
      roi,
    });
  }

  // Calcul des métriques
  const totalMatches = results.length;
  const correctPredictions = results.filter((r) => r.correct).length;
  const accuracy = correctPredictions / totalMatches;
  const avgBrierScore = results.reduce((sum, r) => sum + r.brierScore, 0) / totalMatches;
  const avgConfidence = results.reduce((sum, r) => sum + r.prediction.blendedConfidence, 0) / totalMatches;
  const avgRoi = results.reduce((sum, r) => sum + r.roi, 0) / totalMatches;

  // Par niveau de confiance
  const highConf = results.filter((r) => r.prediction.blendedConfidence > 0.7);
  const medConf = results.filter((r) => r.prediction.blendedConfidence > 0.4 && r.prediction.blendedConfidence <= 0.7);
  const lowConf = results.filter((r) => r.prediction.blendedConfidence <= 0.4);

  // Par taille d'edge
  const strongEdge = results.filter((r) => r.edge > 0.15);
  const moderateEdge = results.filter((r) => r.edge > 0.05 && r.edge <= 0.15);
  const weakEdge = results.filter((r) => r.edge <= 0.05);

  return {
    totalMatches,
    correctPredictions,
    accuracy,
    avgBrierScore,
    avgConfidence,
    roi: avgRoi,
    byConfidence: {
      high: { total: highConf.length, correct: highConf.filter((r) => r.correct).length, accuracy: highConf.length > 0 ? highConf.filter((r) => r.correct).length / highConf.length : 0 },
      medium: { total: medConf.length, correct: medConf.filter((r) => r.correct).length, accuracy: medConf.length > 0 ? medConf.filter((r) => r.correct).length / medConf.length : 0 },
      low: { total: lowConf.length, correct: lowConf.filter((r) => r.correct).length, accuracy: lowConf.length > 0 ? lowConf.filter((r) => r.correct).length / lowConf.length : 0 },
    },
    byEdge: {
      strong: { total: strongEdge.length, correct: strongEdge.filter((r) => r.correct).length, accuracy: strongEdge.length > 0 ? strongEdge.filter((r) => r.correct).length / strongEdge.length : 0 },
      moderate: { total: moderateEdge.length, correct: moderateEdge.filter((r) => r.correct).length, accuracy: moderateEdge.length > 0 ? moderateEdge.filter((r) => r.correct).length / moderateEdge.length : 0 },
      weak: { total: weakEdge.length, correct: weakEdge.filter((r) => r.correct).length, accuracy: weakEdge.length > 0 ? weakEdge.filter((r) => r.correct).length / weakEdge.length : 0 },
    },
  };
}

/**
 * Détails du backtest pour chaque match.
 */
export function getBacktestDetails(): BacktestResult[] {
  return ACTUAL_RESULTS.map((match) => {
    const prediction = predictMatch({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      isHome: true,
    });

    const predictedHomeWin = prediction.blendedPHome > 0.5;
    const actualHomeWin = match.homeScore > match.awayScore;
    const correct = predictedHomeWin === actualHomeWin;
    const brierScore = Math.pow(prediction.blendedPHome - (actualHomeWin ? 1 : 0), 2);
    const edge = Math.abs(prediction.blendedPHome - 0.5);
    const roi = correct ? (edge * 2) : -1;

    return {
      match,
      prediction,
      predictedHomeWin,
      actualHomeWin,
      correct,
      brierScore,
      edge,
      roi,
    };
  });
}
