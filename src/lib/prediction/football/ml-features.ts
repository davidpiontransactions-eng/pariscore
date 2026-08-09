// Feature extraction for football ML models.
// Extracts 20+ features from FootballMatch and derived stats.
// Sources: Elo, xG, form, H2H, standings, context.

import type { FootballMatch } from "../../football-data";
import { eloProb as eloProbEngine } from "./engine";

// ---------------------------------------------------------------------------
// Feature vector (output type)
// ---------------------------------------------------------------------------

export type MLFeatureVector = {
  /** Écart Elo normalisé (homeElo + homeAdv - awayElo) / 400 */
  eloGapNorm: number;
  /** Probabilité Elo domicile [0-1] */
  eloProbHome: number;
  /** Forme domicile pondérée (exp decay, 5 derniers) [0-1] */
  formHome: number;
  /** Forme extérieur pondérée (exp decay, 5 derniers) [0-1] */
  formAway: number;
  /** Différentiel de forme */
  formDiff: number;
  /** PPG domicile (points/match) */
  ppgHome: number;
  /** PPG extérieur */
  ppgAway: number;
  /** Différentiel PPG */
  ppgDiff: number;
  /** xG moyen domicile (si dispo, sinon null) */
  xgHome: number | null;
  /** xG moyen extérieur */
  xgAway: number | null;
  /** Ratio de victoires H2H domicile [0-1] */
  h2hHomeRatio: number;
  /** Avantage terrain : 1 si domicile classé plus haut, 0 sinon */
  homeAdvantage: number;
  /** Classement domicile (normalisé 0-1, 1 = meilleur) */
  rankHomeNorm: number;
  /** Classement extérieur (normalisé 0-1) */
  rankAwayNorm: number;
  /** Buts marqués par match (domicile) */
  goalsScoredHome: number;
  /** Buts encaissés par match (extérieur) */
  goalsConcededAway: number;
  /** Clean sheet % domicile */
  cleanSheetHome: number;
  /** xGd (différentiel xG normalisé [-1,+1]) */
  xGd: number | null;
  /** Tendance de forme (up=1, down=-1, stable=0) */
  formTrendHome: number;
  formTrendAway: number;
  /** Nombre total de features */
  length: number;
};

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

const NEUTRAL_FORM = 0.5;
const FORM_WINDOW = 5;

/** Poids exponentiel pour les matchs de forme (plus récent = plus lourd). */
function formWeight(form: ("W" | "D" | "L")[]): number {
  const recent = form.slice(-FORM_WINDOW);
  if (recent.length === 0) return NEUTRAL_FORM;
  let weighted = 0, total = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = Math.pow(0.85, recent.length - 1 - i);
    const val = recent[i] === "W" ? 1 : recent[i] === "D" ? 0.5 : 0;
    weighted += w * val;
    total += w;
  }
  return total > 0 ? weighted / total : NEUTRAL_FORM;
}

/** Tendance de forme : pente de régression simple sur les 5 derniers. */
function formTrend(form: ("W" | "D" | "L")[]): number {
  const recent = form.slice(-FORM_WINDOW);
  if (recent.length < 3) return 0;
  const vals = recent.map(r => r === "W" ? 1 : r === "D" ? 0.5 : 0);
  const n = vals.length;
  const xMean = (n - 1) / 2;
  const yMean = vals.reduce<number>((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (vals[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  return Math.max(-1, Math.min(1, slope * 5)); // scale to [-1, 1]
}

/**
 * Extrait le vecteur de features depuis un FootballMatch.
 * homeElo/awayElo optionnels (seront estimés si absents).
 */
export function extractFeatures(
  match: FootballMatch,
  homeElo?: number,
  awayElo?: number,
): MLFeatureVector {
  const h = match.home;
  const a = match.away;
  const p = match.prediction;

  // Elo
  const eloH = homeElo ?? 1500;
  const eloA = awayElo ?? 1500;
  const eloGapNorm = (eloH + 100 - eloA) / 400;
  const eloPH = eloProbEngine(eloH, eloA, 100);

  // Forme
  const fHome = formWeight(h.form);
  const fAway = formWeight(a.form);
  const fTrendHome = formTrend(h.form);
  const fTrendAway = formTrend(a.form);

  // PPG (standing)
  const ppgH = p.standingStats?.home?.ppg ?? 1.3;
  const ppgA = p.standingStats?.away?.ppg ?? 1.1;

  // xG
  const xgH = p.xGa?.home ?? null;
  const xgA = p.xGa?.away ?? null;

  // H2H (from predictive bets context — approximate)
  const h2hRatio = 0.5; // placeholder — would need real H2H data

  // Rankings
  const rankHNorm = h.rank > 0 ? 1 - (h.rank - 1) / 20 : 0.5;
  const rankANorm = a.rank > 0 ? 1 - (a.rank - 1) / 20 : 0.5;

  // Goals
  const goalsH = p.metricStats?.home?.goals?.scoredPg?.value ?? 1.3;
  const goalsConcededA = p.metricStats?.away?.goals?.concededPg?.value ?? 1.3;

  // Clean sheet
  const cs = p.teamSeasonStats?.find((s: { label: string; homeAvg: number }) => s.label === "Clean Sheet %");
  const csHome = cs?.homeAvg ?? 30;

  const feat: MLFeatureVector = {
    eloGapNorm,
    eloProbHome: eloPH,
    formHome: fHome,
    formAway: fAway,
    formDiff: fHome - fAway,
    ppgHome: ppgH,
    ppgAway: ppgA,
    ppgDiff: ppgH - ppgA,
    xgHome: xgH,
    xgAway: xgA,
    h2hHomeRatio: h2hRatio,
    homeAdvantage: eloH >= eloA ? 1 : 0,
    rankHomeNorm: rankHNorm,
    rankAwayNorm: rankANorm,
    goalsScoredHome: goalsH,
    goalsConcededAway: goalsConcededA,
    cleanSheetHome: csHome,
    xGd: p.xGd ?? null,
    formTrendHome: fTrendHome,
    formTrendAway: fTrendAway,
    length: 20,
  };

  return feat;
}

/** Convertit le vecteur en array numérique pour les modèles ML. */
export function featureToArray(f: MLFeatureVector): number[] {
  return [
    f.eloGapNorm,
    f.eloProbHome,
    f.formHome,
    f.formAway,
    f.formDiff,
    f.ppgHome,
    f.ppgAway,
    f.ppgDiff,
    f.xgHome ?? 1.35,
    f.xgAway ?? 1.10,
    f.h2hHomeRatio,
    f.homeAdvantage,
    f.rankHomeNorm,
    f.rankAwayNorm,
    f.goalsScoredHome,
    f.goalsConcededAway,
    f.cleanSheetHome / 100,
    f.xGd ?? 0,
    f.formTrendHome,
    f.formTrendAway,
  ];
}
