/**
 * Top 10 matchs rugby par stratégie de pari.
 *
 * Stratégies servies (dérivées du modèle Dixon-Coles rugby) :
 *   - homeWin      → P(victoire domicile) via grille Poisson
 *   - awayWin      → P(victoire extérieur) via grille Poisson
 *   - over415      → P(> 41,5 points) via grille 2D
 *   - under515     → P(< 51,5 points) via grille 2D
 *   - handicapHome → P(domicile couvre -3,5) via grille
 *   - handicapAway → P(extérieur couvre +3,5) via grille
 *   - bttsYes      → P(les 2 marquent ≥ 1 essai) via lambdas
 *   - marginBand   → P(marge ≤ 7 points) via bandes de marge
 *   - bestAttack   → Score attendu total (λH + λA)
 *   - bestDefense  → Défense la plus étanche (min λ encaissé)
 */

import type { RugbyPrediction, PredictedMatch, OverUnderLine } from "./rugby/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RugbyStrategyKey =
  | "homeWin"
  | "awayWin"
  | "over415"
  | "under515"
  | "handicapHome"
  | "handicapAway"
  | "bttsYes"
  | "marginBand"
  | "bestAttack"
  | "bestDefense";

export type RugbyStrategyMatch = {
  matchId: string;
  competition: string;
  competitionSlug: string;
  kickoff: string;
  home: { name: string; logo: string; score?: number | null };
  away: { name: string; logo: string; score?: number | null };
  /** Valeur scorée par le moteur pour la stratégie active. */
  value: number;
  /** Probabilité 0-100 (null si pas une proba). */
  probPct: number | null;
  /** Pick side (home/away/over/under). */
  pick: string;
  /** Données de prédiction brutes. */
  prediction: RugbyPrediction;
  /** Ligne over optimale (proba la plus proche de 60%). */
  bestOverLine: { line: number; prob: number } | null;
  /** Ligne under optimale (proba la plus proche de 60%). */
  bestUnderLine: { line: number; prob: number } | null;
};

/* ------------------------------------------------------------------ */
/* Stratégies                                                          */
/* ------------------------------------------------------------------ */

export type RugbyStrategyDef = {
  key: RugbyStrategyKey;
  label: string;
  emoji: string;
  isProb: boolean;
  format: (v: number) => string;
};

export const RUGBY_STRATEGIES: RugbyStrategyDef[] = [
  { key: "homeWin", label: "Victoire domicile", emoji: "🏠", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "awayWin", label: "Victoire extérieur", emoji: "✈️", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "over415", label: "Over 41,5 points", emoji: "🔥", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "under515", label: "Under 51,5 points", emoji: "❄️", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "handicapHome", label: "Handicap -3,5 domicile", emoji: "📊", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "handicapAway", label: "Handicap +3,5 extérieur", emoji: "📊", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "bttsYes", label: "Les 2 marquent", emoji: "🏉", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "marginBand", label: "Marge ≤ 7 points", emoji: "📏", isProb: true, format: (v) => `${v.toFixed(0)}%` },
  { key: "bestAttack", label: "Meilleure attaque", emoji: "⚡", isProb: false, format: (v) => `${v.toFixed(1)} pts` },
  { key: "bestDefense", label: "Meilleure défense", emoji: "🧱", isProb: false, format: (v) => `${v.toFixed(1)} enc` },
];

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function findOverUnderLine(lines: OverUnderLine[], target: number): OverUnderLine | null {
  let best: OverUnderLine | null = null;
  let bestDiff = Infinity;
  for (const l of lines) {
    const diff = Math.abs(l.line - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = l;
    }
  }
  return best;
}

/**
 * Trouve la ligne over/under dont la probabilité est la plus proche de 60%.
 * Objectif : afficher un pari "value" — proba ~60% = cote implicite ~1.67,
 * seuil classique de value betting (ni trop sûr ni trop risqué).
 *
 * Cherche parmi toutes les lignes disponibles (dynamiques + classiques).
 * Priorité : proba >= 55% ET <= 68% (fenêtre de value), sinon la plus proche de 60%.
 */
function findBestLineNear60(
  lines: OverUnderLine[],
  side: "over" | "under",
): { line: number; prob: number } | null {
  if (!lines.length) return null;

  const TARGET = 0.60;
  const MIN_OK = 0.55;
  const MAX_OK = 0.68;

  // Chercher dans la fenêtre "value" d'abord
  let bestInWindow: { line: number; prob: number } | null = null;
  let bestDiffInWindow = Infinity;

  // Sinon, chercher le plus proche de 60%
  let bestOverall: { line: number; prob: number } | null = null;
  let bestDiffOverall = Infinity;

  for (const l of lines) {
    const prob = side === "over" ? l.over : l.under;
    const diff = Math.abs(prob - TARGET);

    if (prob >= MIN_OK && prob <= MAX_OK) {
      if (diff < bestDiffInWindow) {
        bestDiffInWindow = diff;
        bestInWindow = { line: l.line, prob };
      }
    }
    if (diff < bestDiffOverall) {
      bestDiffOverall = diff;
      bestOverall = { line: l.line, prob };
    }
  }

  return bestInWindow ?? bestOverall;
}

function scoreRugbyMatch(
  pm: PredictedMatch,
  strategy: RugbyStrategyKey,
): { value: number; probPct: number | null; pick: string } | null {
  const pred = pm.prediction;
  if (!pred) return null;

  switch (strategy) {
    case "homeWin":
      return { value: pred.homeWinProb * 100, probPct: pred.homeWinProb * 100, pick: "home" };
    case "awayWin":
      return { value: pred.awayWinProb * 100, probPct: pred.awayWinProb * 100, pick: "away" };
    case "over415": {
      const line = findOverUnderLine(pred.overUnderLines, 41.5);
      if (!line) return null;
      return { value: line.over * 100, probPct: line.over * 100, pick: "over" };
    }
    case "under515": {
      const line = findOverUnderLine(pred.overUnderLines, 51.5);
      if (!line) return null;
      return { value: line.under * 100, probPct: line.under * 100, pick: "under" };
    }
    case "handicapHome": {
      const handicap = pred.handicap;
      if (!handicap) return null;
      return { value: handicap.homeCoverProb * 100, probPct: handicap.homeCoverProb * 100, pick: "home" };
    }
    case "handicapAway": {
      const handicap = pred.handicap;
      if (!handicap) return null;
      return { value: handicap.awayCoverProb * 100, probPct: handicap.awayCoverProb * 100, pick: "away" };
    }
    case "bttsYes": {
      const pHomeScores = 1 - Math.exp(-pred.lambdaHome);
      const pAwayScores = 1 - Math.exp(-pred.lambdaAway);
      const btts = pHomeScores * pAwayScores * 100;
      return { value: btts, probPct: btts, pick: "yes" };
    }
    case "marginBand": {
      const closeMargin = pred.marginBands.find((b) => b.label.includes("7") || b.label.includes("1-7"));
      if (closeMargin) {
        const p = (closeMargin.homeProb + closeMargin.awayProb) * 100;
        return { value: p, probPct: p, pick: "close" };
      }
      const pClose = pred.marginBands
        .filter((b) => {
          const num = parseInt(b.label);
          return !isNaN(num) && num <= 7;
        })
        .reduce((sum, b) => sum + b.homeProb + b.awayProb, 0);
      return { value: pClose * 100, probPct: pClose * 100, pick: "close" };
    }
    case "bestAttack": {
      const total = pred.expectedHomeScore + pred.expectedAwayScore;
      return { value: total, probPct: null, pick: total > 0 ? "over" : "under" };
    }
    case "bestDefense": {
      const minLambda = Math.min(pred.lambdaHome, pred.lambdaAway);
      return { value: minLambda, probPct: null, pick: minLambda === pred.lambdaHome ? "home" : "away" };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Entrypoint                                                          */
/* ------------------------------------------------------------------ */

export function computeRugbyTopStrategies(
  matches: PredictedMatch[],
  strategy: RugbyStrategyKey,
  limit: number = 10,
): RugbyStrategyMatch[] {
  const scored: RugbyStrategyMatch[] = [];

  for (const pm of matches) {
    const result = scoreRugbyMatch(pm, strategy);
    if (!result) continue;

    // Calculer les lignes over/under optimales (~60% proba) pour CE match
    const ouLines = pm.prediction?.overUnderLines ?? [];
    const bestOverLine = findBestLineNear60(ouLines, "over");
    const bestUnderLine = findBestLineNear60(ouLines, "under");

    scored.push({
      matchId: pm.match.id,
      competition: pm.match.competitionSlug,
      competitionSlug: pm.match.competitionSlug,
      kickoff: pm.match.date,
      home: {
        name: pm.match.home.name,
        logo: pm.match.home.logo,
        score: pm.match.homeScore,
      },
      away: {
        name: pm.match.away.name,
        logo: pm.match.away.logo,
        score: pm.match.awayScore,
      },
      value: result.value,
      probPct: result.probPct,
      pick: result.pick,
      prediction: pm.prediction!,
      bestOverLine,
      bestUnderLine,
    });
  }

  // Tri : stratégies "bestDefense" ascending, le reste descending
  const ascending = strategy === "bestDefense";
  scored.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

  return scored.slice(0, limit);
}
