/**
 * Walk-Forward Validation pour le modèle de prédiction football.
 *
 * Validation glissante : entraîne sur une fenêtre de N matchs, prédit les M
 * suivants, avance de K matchs, répète. Métriques agrégées : Brier score,
 * log-loss, accuracy, ROI simulé.
 *
 * Approche réaliste : chaque fenêtre de test utilise uniquement les données
 * d'entraînement disponibles à ce point dans le temps (pas de fuite de données).
 */

import type { FootballMatch } from "@/lib/football-data";
import { brierScore, logLoss, accuracy } from "./brier-score";
import { round2 } from "./math-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalkForwardOptions = {
  /** Nombre de matchs utilisés pour l'entraînement (fenêtre glissante). */
  trainWindow: number;
  /** Nombre de matchs prédits par pas. */
  testWindow: number;
  /** Pas d'avancement en nombre de matchs. */
  stepSize: number;
};

export type WalkForwardPrediction = {
  matchId: string;
  date: string;
  /** Outcome réel normalisé : 1, 0.5 (nul), ou 0 pour 1X2. */
  actual: number;
  /** Probabilité prédite par le modèle pour l'issue choisie. */
  predicted: number;
  /** Issue choisie par le modèle ("1", "X", "2", "BTTS", "OVER25"). */
  pick: string;
  /** Cote marché (si disponible) pour calcul ROI. */
  odds: number | null;
  /** true si le pari gagne. */
  won: boolean;
};

export type MarketMetrics = {
  brier: number;
  logLoss: number;
  accuracy: number;
  roi: number;
  sampleSize: number;
};

export type WalkForwardResult = {
  predictions: WalkForwardPrediction[];
  /** Métriques agrégées par marché. */
  metrics: {
    brierScore: number;
    logLoss: number;
    accuracy: number;
    roi: number;
    /** Détail par marché. */
    markets: {
      "1X2": MarketMetrics;
      BTTS: MarketMetrics;
      O25: MarketMetrics;
    };
  };
  /** Nombre de fenêtres testées. */
  windows: number;
};

// ---------------------------------------------------------------------------
// Extraction des outcomes réels
// ---------------------------------------------------------------------------

/** Outcome réel 1X2 : 1=dom, 0.5=nul, 0=ext. */
function actual1X2(match: FootballMatch): number | null {
  const live = match.live;
  if (!live || live.status !== "FT") return null;
  if (live.homeScore > live.awayScore) return 1;
  if (live.homeScore < live.awayScore) return 0;
  return 0.5;
}

/** Outcome BTTS : 1 si les deux équipes marquent, 0 sinon. */
function actualBTTS(match: FootballMatch): number | null {
  const live = match.live;
  if (!live || live.status !== "FT") return null;
  return live.homeScore >= 1 && live.awayScore >= 1 ? 1 : 0;
}

/** Outcome Over 2.5 : 1 si ≥ 3 buts, 0 sinon. */
function actualOver25(match: FootballMatch): number | null {
  const live = match.live;
  if (!live || live.status !== "FT") return null;
  return (live.homeScore + live.awayScore) >= 3 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Modèle simplifié pour le walk-forward (baseline fréquentiste)
// ---------------------------------------------------------------------------

/**
 * Entraîne un modèle baseline sur les matchs d'entraînement et prédit
 * pour un match test. Utilise les fréquences historiques des outcomes.
 */
function trainAndPredict(
  trainMatches: FootballMatch[],
  _testMatch: FootballMatch,
): {
  "1X2": { pick: string; prob: number };
  BTTS: { pick: string; prob: number };
  O25: { pick: string; prob: number };
} {
  let home = 0, draw = 0, away = 0, btts = 0, over25 = 0, total = 0;
  for (const m of trainMatches) {
    const o1x2 = actual1X2(m);
    const oBTTS = actualBTTS(m);
    const oO25 = actualOver25(m);
    if (o1x2 == null) continue;
    total++;
    if (o1x2 === 1) home++;
    else if (o1x2 === 0.5) draw++;
    else away++;
    if (oBTTS != null && oBTTS === 1) btts++;
    if (oO25 != null && oO25 === 1) over25++;
  }

  if (total === 0) {
    return {
      "1X2": { pick: "1", prob: 0.33 },
      BTTS: { pick: "YES", prob: 0.50 },
      O25: { pick: "OVER", prob: 0.50 },
    };
  }

  const pH = home / total;
  const pD = draw / total;
  const pA = away / total;
  const pBTTS = btts / total;
  const pO25 = over25 / total;

  let pick1X2 = "1";
  let prob1X2 = pH;
  if (pD > prob1X2) { pick1X2 = "X"; prob1X2 = pD; }
  if (pA > prob1X2) { pick1X2 = "2"; prob1X2 = pA; }

  return {
    "1X2": { pick: pick1X2, prob: round2(prob1X2) },
    BTTS: { pick: pBTTS >= 0.5 ? "YES" : "NO", prob: round2(pBTTS >= 0.5 ? pBTTS : 1 - pBTTS) },
    O25: { pick: pO25 >= 0.5 ? "OVER" : "UNDER", prob: round2(pO25 >= 0.5 ? pO25 : 1 - pO25) },
  };
}

// ---------------------------------------------------------------------------
// Walk-forward validation
// ---------------------------------------------------------------------------

/**
 * Validation glissante walk-forward sur une série chronologique de matchs.
 *
 * Les matchs doivent être triés par date croissante. La fenêtre d'entraînement
 * avance de `stepSize` matchs à chaque itération, garantissant qu'aucune donnée
 * future ne fuite dans l'entraînement.
 */
export function walkForwardValidation(
  matches: FootballMatch[],
  options: WalkForwardOptions,
): WalkForwardResult {
  const { trainWindow, testWindow, stepSize } = options;

  // Filtrer et trier les matchs terminés avec odds
  const finished = matches
    .filter((m) => m.live?.status === "FT" && m.odds)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  if (finished.length < trainWindow + testWindow) {
    return {
      predictions: [],
      metrics: {
        brierScore: NaN,
        logLoss: NaN,
        accuracy: NaN,
        roi: NaN,
        markets: {
          "1X2": { brier: NaN, logLoss: NaN, accuracy: NaN, roi: NaN, sampleSize: 0 },
          BTTS: { brier: NaN, logLoss: NaN, accuracy: NaN, roi: NaN, sampleSize: 0 },
          O25: { brier: NaN, logLoss: NaN, accuracy: NaN, roi: NaN, sampleSize: 0 },
        },
      },
      windows: 0,
    };
  }

  const allPredictions: WalkForwardPrediction[] = [];
  let windows = 0;

  for (let start = 0; start + trainWindow + testWindow <= finished.length; start += stepSize) {
    windows++;
    const trainSlice = finished.slice(start, start + trainWindow);
    const testSlice = finished.slice(start + trainWindow, start + trainWindow + testWindow);

    for (const m of testSlice) {
      const pred = trainAndPredict(trainSlice, m);

      // --- 1X2 ---
      const o1x2 = actual1X2(m);
      if (o1x2 != null) {
        const outcome1X2 = pred["1X2"].pick === "1" ? 1
          : pred["1X2"].pick === "X" ? 0.5
          : 0;
        allPredictions.push({
          matchId: m.id,
          date: m.scheduledAt,
          actual: o1x2,
          predicted: pred["1X2"].prob,
          pick: pred["1X2"].pick,
          odds: m.odds ? m.odds.home : null,
          won: outcome1X2 === o1x2,
        });
      }

      // --- BTTS ---
      const oBTTS = actualBTTS(m);
      if (oBTTS != null) {
        const pickBTTS = pred.BTTS.pick === "YES" ? 1 : 0;
        allPredictions.push({
          matchId: m.id,
          date: m.scheduledAt,
          actual: oBTTS,
          predicted: pred.BTTS.prob,
          pick: `BTTS_${pred.BTTS.pick}`,
          odds: null,
          won: pickBTTS === oBTTS,
        });
      }

      // --- Over 2.5 ---
      const oO25 = actualOver25(m);
      if (oO25 != null) {
        const pickO25 = pred.O25.pick === "OVER" ? 1 : 0;
        allPredictions.push({
          matchId: m.id,
          date: m.scheduledAt,
          actual: oO25,
          predicted: pred.O25.prob,
          pick: `OU_${pred.O25.pick}`,
          odds: null,
          won: pickO25 === oO25,
        });
      }
    }
  }

  // Agrégation par marché
  const filter1X2 = allPredictions.filter((p) => !p.pick.startsWith("BTTS_") && !p.pick.startsWith("OU_"));
  const filterBTTS = allPredictions.filter((p) => p.pick.startsWith("BTTS_"));
  const filterO25 = allPredictions.filter((p) => p.pick.startsWith("OU_"));

  const computeMetrics = (preds: WalkForwardPrediction[]): MarketMetrics => {
    if (preds.length === 0) {
      return { brier: NaN, logLoss: NaN, accuracy: NaN, roi: NaN, sampleSize: 0 };
    }
    const predicted = preds.map((p) => p.predicted);
    const actualVals = preds.map((p) => p.actual);
    const pnl = preds.reduce((sum, p) => {
      if (p.won && p.odds != null && p.odds > 1) return sum + (p.odds - 1);
      return sum - 1;
    }, 0);

    return {
      brier: round2(brierScore(predicted, actualVals)),
      logLoss: round2(logLoss(predicted, actualVals)),
      accuracy: round2(accuracy(predicted, actualVals)),
      roi: round2((pnl / preds.length) * 100),
      sampleSize: preds.length,
    };
  };

  const m1X2 = computeMetrics(filter1X2);
  const mBTTS = computeMetrics(filterBTTS);
  const mO25 = computeMetrics(filterO25);

  const allPred = allPredictions.map((p) => p.predicted);
  const allAct = allPredictions.map((p) => p.actual);

  return {
    predictions: allPredictions,
    metrics: {
      brierScore: allPred.length > 0 ? round2(brierScore(allPred, allAct)) : NaN,
      logLoss: allPred.length > 0 ? round2(logLoss(allPred, allAct)) : NaN,
      accuracy: allPred.length > 0 ? round2(accuracy(allPred, allAct)) : NaN,
      roi: allPredictions.length > 0
        ? round2(
            (allPredictions.reduce((sum, p) => {
              if (p.won && p.odds != null && p.odds > 1) return sum + (p.odds - 1);
              return sum - 1;
            }, 0) / allPredictions.length) * 100,
          )
        : NaN,
      markets: {
        "1X2": m1X2,
        BTTS: mBTTS,
        O25: mO25,
      },
    },
    windows,
  };
}
