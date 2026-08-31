/**
 * Détection de drift des prédictions football.
 *
 * Compare les scores Brier récents vs une période de référence (baseline)
 * pour détériorer une dérive significative. Analyse par marché (1X2, BTTS, Over 2.5).
 *
 * Seuil de drift : Brier récent > Brier baseline + 0.02 (seuil empirique).
 */

import { brierScore } from "./brier-score";
import type { PredictionLog } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketDriftResult = {
  market: string;
  baselineBrier: number;
  recentBrier: number;
  drift: number;
  significant: boolean;
};

export type DriftDetectionResult = {
  drifted: boolean;
  metrics: MarketDriftResult[];
  summary: string;
};

// ---------------------------------------------------------------------------
// Seuil de drift (différence Brier minimale pour signaler une dérive)
// ---------------------------------------------------------------------------

const DRIFT_THRESHOLD = 0.02;

// ---------------------------------------------------------------------------
// Extraction des probabilités par marché depuis PredictionLog
// ---------------------------------------------------------------------------

/**
 * Extrait les paires (predicted, actual) pour un marché binaire donné.
 * Retourne { predicted: number[], actual: number[] } où actual ∈ {0, 1}.
 */
function extractMarketPairs(
  logs: PredictionLog[],
  market: "btts" | "over25",
): { predicted: number[]; actual: number[] } {
  const predicted: number[] = [];
  const actual: number[] = [];

  for (const log of logs) {
    // Ignorer les logs non settlement ou sans la prob du marché
    if (!log.settled || log.actualHome === null || log.actualAway === null) continue;

    const prob = market === "btts" ? log.bttsProb : log.over25Prob;
    if (prob === null || prob === undefined) continue;

    const outcome =
      market === "btts"
        ? log.actualHome > 0 && log.actualAway > 0
          ? 1
          : 0
        : log.actualHome + log.actualAway > 2
          ? 1
          : 0;

    predicted.push(prob);
    actual.push(outcome);
  }

  return { predicted, actual };
}

/**
 * Extrait les paires (predicted, actual) pour le marché 1X2.
 * Utilise le Brier score multiclasse via la somme des carrés par issue.
 */
function extract1x2Pairs(
  logs: PredictionLog[],
): { predicted: number[]; actual: number[] } {
  // Pour 1X2, on calcule le Brier par issue (home, draw, away)
  // puis on moyenne — équivalent au Brier score multiclasse / 3.
  const predicted: number[] = [];
  const actual: number[] = [];

  for (const log of logs) {
    if (!log.settled || log.actualHome === null || log.actualAway === null) continue;

    const outcomeHome = log.actualHome > log.actualAway ? 1 : 0;
    const outcomeDraw = log.actualHome === log.actualAway ? 1 : 0;
    const outcomeAway = log.actualHome < log.actualAway ? 1 : 0;

    // Brier 1X2 = moyenne des 3 Brier binaires (home, draw, away)
    const brierHome = (log.homeProb - outcomeHome) ** 2;
    const brierDraw = (log.drawProb - outcomeDraw) ** 2;
    const brierAway = (log.awayProb - outcomeAway) ** 2;
    const avgBrier = (brierHome + brierDraw + brierAway) / 3;

    // On stocke une valeur synthétique pour calculer la moyenne
    // Multiply by 3 then divide later to keep semantic clean
    predicted.push(avgBrier * 3);
    actual.push(1); // placeholder pour moyenne
  }

  return { predicted, actual };
}

// ---------------------------------------------------------------------------
// Calcul du Brier score moyen pour un marché
// ---------------------------------------------------------------------------

function meanBrier(logs: PredictionLog[], market: string): number {
  if (market === "1x2") {
    const { predicted } = extract1x2Pairs(logs);
    if (predicted.length === 0) return NaN;
    // predicted contient déjà les Brier individuels * 3, on divise par 3
    return predicted.reduce((s, v) => s + v / 3, 0) / predicted.length;
  }

  const { predicted, actual } = extractMarketPairs(logs, market as "btts" | "over25");
  if (predicted.length === 0) return NaN;
  return brierScore(predicted, actual);
}

// ---------------------------------------------------------------------------
// Fonction principale de détection de drift
// ---------------------------------------------------------------------------

/**
 * Compare les prédictions récentes vs la période de référence.
 *
 * @param recent - logs de la période récente (ex: 7 derniers jours)
 * @param baseline - logs de la période de référence (ex: 90 jours)
 * @returns Résultat du drift avec métriques par marché et résumé
 */
export function detectDrift(
  recent: PredictionLog[],
  baseline: PredictionLog[],
): DriftDetectionResult {
  const markets = ["1x2", "btts", "over25"];
  const metrics: MarketDriftResult[] = [];
  let anyDrifted = false;

  for (const market of markets) {
    const baselineBrier = meanBrier(baseline, market);
    const recentBrier = meanBrier(recent, market);

    // Pas de drift si pas assez de données
    if (Number.isNaN(baselineBrier) || Number.isNaN(recentBrier)) {
      metrics.push({
        market,
        baselineBrier: Number.isNaN(baselineBrier) ? 0 : baselineBrier,
        recentBrier: Number.isNaN(recentBrier) ? 0 : recentBrier,
        drift: 0,
        significant: false,
      });
      continue;
    }

    const drift = recentBrier - baselineBrier;
    const significant = drift > DRIFT_THRESHOLD;

    if (significant) anyDrifted = true;

    metrics.push({
      market,
      baselineBrier: round4(baselineBrier),
      recentBrier: round4(recentBrier),
      drift: round4(drift),
      significant,
    });
  }

  // Génération du résumé
  const driftedMarkets = metrics.filter((m) => m.significant);
  let summary: string;

  if (driftedMarkets.length === 0) {
    summary = "Aucun drift détecté — les performances sont stables.";
  } else {
    const names = driftedMarkets.map((m) => m.market.toUpperCase()).join(", ");
    summary = `Drift détecté sur ${names}. `;
    for (const m of driftedMarkets) {
      summary += `[${m.market.toUpperCase()}] Brier ${m.baselineBrier} → ${m.recentBrier} (+${m.drift}). `;
    }
  }

  return {
    drifted: anyDrifted,
    metrics,
    summary: summary.trim(),
  };
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
