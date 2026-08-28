import {
  brierScore,
  expectedCalibrationError,
  roi,
  calibrationVerdict,
  type CalibrationVerdict,
} from "./cs2-calibration";

/**
 * backtest-core.ts — Logique pure du harness de backtest CS2.
 * ---------------------------------------------------------------------------------
 * Évalue la calibration d'un marché (winner / map / over / handicap) à partir d'un
 * historique de prédictions { prob, outcome, odds }. Réutilise cs2-calibration
 * (Brier/ECE/ROI) et le gate "OK/NO-GO" (n≥30, brier≤0.25, ece≤0.10) — papier de
 * référence : Walsh & Joshi, arXiv 2303.06021 (calibration > accuracy pour le ROI).
 */

export type BacktestRecord = {
  /** Proba prédite par le modèle (0-1). */
  prob: number;
  /** Résultat réel : 1 = pari gagné, 0 = perdu. */
  outcome: 0 | 1;
  /** Cote décimale moyenne au moment du pari (pour le calcul du ROI). */
  odds: number;
};

export type MarketCalibration = {
  market: string;
  n: number;
  brier: number;
  ece: number;
  roi: number;
  verdict: CalibrationVerdict;
  /** Date de fin de fenêtre (ISO) — pour la traçabilité du rapport. */
  windowEnd?: string;
};

/**
 * Évalue la calibration d'un marché sur un historique de records.
 */
export function evaluateMarkets(records: BacktestRecord[], market: string): MarketCalibration {
  const n = records.length;
  if (n === 0) {
    return { market, n: 0, brier: 0, ece: 0, roi: 0, verdict: "NO-GO" };
  }
  const probs = records.map((r) => r.prob);
  const outcomes = records.map((r) => r.outcome);
  const avgOdds = records.reduce((a, r) => a + r.odds, 0) / n;

  const brier = brierScore(probs, outcomes);
  const ece = expectedCalibrationError(probs, outcomes);
  const roiPct = roi(probs, outcomes, avgOdds);

  return {
    market,
    n,
    brier: +brier.toFixed(4),
    ece: +ece.toFixed(4),
    roi: +roiPct.toFixed(2),
    verdict: calibrationVerdict({ brier, ece, roi: roiPct, n }),
  };
}

/**
 * Agrège plusieurs marchés en un rapport unique (format data/cs2-backtest-report.json).
 */
export function buildBacktestReport(
  markets: Record<string, BacktestRecord[]>,
  windowEnd?: string,
): Record<string, MarketCalibration> {
  const out: Record<string, MarketCalibration> = {};
  for (const [market, records] of Object.entries(markets)) {
    out[market] = { ...evaluateMarkets(records, market), windowEnd };
  }
  return out;
}