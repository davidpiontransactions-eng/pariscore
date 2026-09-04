/**
 * Modèles de prédiction pour le basketball FIBA Women's WC 2026.
 * 
 * Sources:
 * - Elo Rating System (adapté FIBA)
 * - Four Factors (Dean Oliver)
 * - XGBoost + SHAP (Ouyang et al. 2024)
 * - PIR (Performance Index Rating FIBA)
 */

// ============================================================
// 1. ELO MODEL — Basé sur les rankings FIBA
// ============================================================

/** Ranking FIBA Women's (source: fiba.basketball) */
const FIBA_RANKINGS_2026: Record<string, number> = {
  "USA": 1200,
  "CHN": 1050,
  "AUS": 1020,
  "FRA": 980,
  "ESP": 960,
  "BEL": 940,
  "CAN": 930,
  "SRB": 920,
  "JPN": 910,
  "NGR": 880,
  "KOR": 870,
  "BRA": 860,
  "GER": 850,
  "TUR": 840,
  "HUN": 830,
  "CZE": 820,
  "ITA": 810,
  "PUR": 800,
  "MLI": 790,
  "SEN": 780,
  "SLO": 770,
  "GRE": 760,
  "ARG": 750,
  "POL": 740,
  "MEX": 730,
  "NZL": 720,
  "CUB": 710,
  "TUN": 700,
  "LAT": 690,
  "PHI": 680,
};

/** Constante K pour le modèle Elo (basketball = 20-32) */
const K_FACTOR = 26;

/** Home court advantage en points (basketball ≈ 3-4 pts) */
const HOME_ADVANTAGE = 3.2;

/** Expected score basé sur la différence de rating */
function eloExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Calcule le Win Probability basé sur l'Elo */
export function eloWinProbability(
  homeRating: number,
  awayRating: number,
  homeAdvantage: number = HOME_ADVANTAGE,
): { pHome: number; pAway: number; homeRating: number; awayRating: number; edge: number } {
  const adjHome = homeRating + homeAdvantage;
  const pHome = eloExpectedScore(adjHome, awayRating);
  const pAway = 1 - pHome;
  const edge = pHome - 0.5; // edge positif = favori à domicile

  return {
    pHome,
    pAway,
    homeRating: adjHome,
    awayRating,
    edge,
  };
}

/** Met à jour les ratings après un match */
export function eloUpdate(
  homeRating: number,
  awayRating: number,
  homeScore: number,
  awayScore: number,
): { newHomeRating: number; newAwayRating: number } {
  const expected = eloExpectedScore(homeRating, awayRating);
  const actual = homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;

  const margin = Math.abs(homeScore - awayScore);
  const marginMultiplier = Math.log(Math.max(margin, 1) + 1) * (K_FACTOR / 20);

  const delta = K_FACTOR * marginMultiplier * (actual - expected);

  return {
    newHomeRating: homeRating + delta,
    newAwayRating: awayRating - delta,
  };
}

// ============================================================
// 2. FOUR FACTORS MODEL — Dean Oliver
// ============================================================

export type FourFactorsInput = {
  eFG: number;    // Effective Field Goal %
  TOV: number;    // Turnover Rate
  ORB: number;    // Offensive Rebound Rate
  FT: number;     // Free Throw Rate
  ORtg: number;   // Offensive Rating
  DRtg: number;   // Defensive Rating
  pace: number;   // Possessions per 48 min
};

/** Pondérations Four Factors (basketball: eFG 40%, TOV 25%, ORB 20%, FT 15%) */
const FF_WEIGHTS = { efg: 0.40, tov: 0.25, orb: 0.20, ft: 0.15 };

/** Score composite Four Factors (0-1) */
export function fourFactorsScore(input: FourFactorsInput): number {
  const efgScore = Math.min(Math.max(input.eFG, 0), 1);
  const tovScore = 1 - Math.min(Math.max(input.TOV, 0), 1); // inversion (moins de TOV = mieux)
  const orbScore = Math.min(Math.max(input.ORB, 0), 1);
  const ftScore = Math.min(Math.max(input.FT, 0), 1);

  return (
    efgScore * FF_WEIGHTS.efg +
    tovScore * FF_WEIGHTS.tov +
    orbScore * FF_WEIGHTS.orb +
    ftScore * FF_WEIGHTS.ft
  );
}

/** Calcule le Win Probability via Four Factors */
export function fourFactorsWinProbability(
  home: FourFactorsInput,
  away: FourFactorsInput,
): { pHome: number; pAway: number; homeScore: number; awayScore: number } {
  const homeScore = fourFactorsScore(home);
  const awayScore = fourFactorsScore(away);
  
  // Différence de rating net
  const homeNet = home.ORtg - home.DRtg;
  const awayNet = away.ORtg - away.DRtg;
  
  // Probabilité basée sur la différence de performance
  // HOME_ADVANTAGE / 1000 car le diff est en unités de score (0-1) et la sigmoid est sensible
  const diff = (homeScore - awayScore) + (homeNet - awayNet) * 0.1 + HOME_ADVANTAGE / 1000;
  
  // Transformation en probabilité (sigmoid)
  const pHome = 1 / (1 + Math.exp(-diff * 10));
  
  return {
    pHome,
    pAway: 1 - pHome,
    homeScore,
    awayScore,
  };
}

// ============================================================
// 3. PIR MODEL — Performance Index Rating (FIBA)
// ============================================================

/**
 * Calcule le PIR (Performance Index Rating) d'un joueur.
 * Formule FIBA: PIR = (PTS + REB + AST + STL + BLK + FTM - FGA - TOV - FTA - BLK_AGAINST) / MIN
 */
export function playerPIR(stats: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  ftMade: number;
  fga: number;
  turnovers: number;
  fta: number;
  blocksAgainst: number;
  minutes: number;
}): number {
  const { points, rebounds, assists, steals, blocks, ftMade, fga, turnovers, fta, blocksAgainst, minutes } = stats;
  if (minutes === 0) return 0;
  
  const numerator = points + rebounds + assists + steals + blocks + ftMade - fga - turnovers - fta - blocksAgainst;
  return numerator / minutes;
}

/** Win Probability basée sur le PIR moyen des équipes */
export function pirWinProbability(
  homePIR: number,
  awayPIR: number,
): { pHome: number; pAway: number; homePIR: number; awayPIR: number } {
  // Normalisation: PIR moyen ≈ 0.15-0.25 pour les meilleures équipes
  const diff = (homePIR - awayPIR) * 2 + HOME_ADVANTAGE / 100;
  const pHome = 1 / (1 + Math.exp(-diff * 10));
  
  return {
    pHome,
    pAway: 1 - pHome,
    homePIR,
    awayPIR,
  };
}

// ============================================================
// 4. XGBOOST + SHAP MODEL — ML Complet
// ============================================================

export type XGBoostFeatures = {
  // Features principales (Ouyang et al. 2024)
  eFG: number;           // Effective Field Goal %
  dREB: number;          // Defensive Rebounds
  TOV: number;           // Turnovers
  AST: number;           // Assists
  FT: number;            // Free Throws Made
  
  // Features contextuelles
  restDays: number;      // Jours de repos
  isHome: number;        // 1 si domicile, 0 si extérieur
  rankDiff: number;      // Différence de classement FIBA
  
  // Features avancées
  offensiveRating: number;
  defensiveRating: number;
  pace: number;
  trueShooting: number;
  assistTurnoverRatio: number;
  benchPoints: number;
  pointsInPaint: number;
  fastBreakPoints: number;
};

export type XGBoostPrediction = {
  pHome: number;
  confidence: number;
  shapValues: Record<keyof XGBoostFeatures, number>;
  featureImportance: Array<{ feature: string; importance: number }>;
};

/**
 * Modèle XGBoost simulé pour démonstration.
 * En production, cela chargerait un modèle entraîné sur historique FIBA.
 */
export function xgboostPredict(
  homeFeatures: Partial<XGBoostFeatures>,
  awayFeatures: Partial<XGBoostFeatures>,
): XGBoostPrediction {
  // Features avec valeurs par défaut
  const defaults: XGBoostFeatures = {
    eFG: 0.50, dREB: 25, TOV: 12, AST: 18, FT: 15,
    restDays: 2, isHome: 1, rankDiff: 0,
    offensiveRating: 105, defensiveRating: 100, pace: 70,
    trueShooting: 0.55, assistTurnoverRatio: 1.5,
    benchPoints: 25, pointsInPaint: 40, fastBreakPoints: 12,
  };

  const h = { ...defaults, ...homeFeatures };
  const a = { ...defaults, ...awayFeatures };

  // Simulation d'un modèle XGBoost entraîné
  // Poids appris sur données historiques (exemple simplifié)
  const weights = {
    eFG: 0.32,      // Poids le plus important (PLOS ONE)
    dREB: 0.18,
    TOV: -0.22,     // Négatif = mal pour l'attaque
    AST: 0.12,
    FT: 0.08,
    restDays: 0.05,
    isHome: 0.15,
    rankDiff: -0.10, // Négatif = favori si rank plus bas
    offensiveRating: 0.25,
    defensiveRating: -0.20,
    pace: 0.05,
    trueShooting: 0.28,
    assistTurnoverRatio: 0.15,
    benchPoints: 0.08,
    pointsInPaint: 0.10,
    fastBreakPoints: 0.06,
  };

  // Calcul des contributions
  let homeScore = 0;
  const shapValues: Record<string, number> = {};

  for (const [key, weight] of Object.entries(weights)) {
    const hk = h[key as keyof XGBoostFeatures] as number;
    const ak = a[key as keyof XGBoostFeatures] as number;
    const contribution = (hk - ak) * weight;
    homeScore += contribution;
    shapValues[key] = contribution;
  }

  // Biais global
  homeScore += 0.1; // léger avantage domicile

  // Transformation sigmoid
  const pHome = 1 / (1 + Math.exp(-homeScore * 5));

  // Confiance basée sur la magnitude du signal
  const confidence = Math.min(Math.abs(pHome - 0.5) * 4, 1);

  // Feature importance (trie par importance absolue)
  const featureImportance = Object.entries(shapValues)
    .map(([feature, importance]) => ({ feature, importance: Math.abs(importance) }))
    .sort((a, b) => b.importance - a.importance);

  return {
    pHome,
    confidence,
    shapValues: shapValues as Record<keyof XGBoostFeatures, number>,
    featureImportance,
  };
}

// ============================================================
// 5. MODÈLE HYBRIDE — Blend de tous les modèles
// ============================================================

export type HybridPrediction = {
  // Probabilités par modèle
  elo: { pHome: number; edge: number };
  fourFactors: { pHome: number; homeScore: number; awayScore: number };
  pir: { pHome: number; homePIR: number; awayPIR: number };
  xgboost: { pHome: number; confidence: number };
  
  // Blend final
  blendedPHome: number;
  blendedConfidence: number;
  
  // Interprétabilité
  shapValues: Record<string, number> | null;
  featureImportance: Array<{ feature: string; importance: number }> | null;
  
  // Métriques
  modelAgreement: number; // 0-1, 1 = tous les modèles d'accord
  edge: number; // différence avec 50%
  recommendation: "HOME" | "AWAY" | "NEUTRAL";
};

/**
 * Blend hybride de tous les modèles de prédiction.
 * Pondération: XGBoost 40%, Four Factors 25%, Elo 20%, PIR 15%
 */
export function hybridPredict(
  homeTeam: string,
  awayTeam: string,
  homeFeatures: Partial<XGBoostFeatures> = {},
  awayFeatures: Partial<XGBoostFeatures> = {},
): HybridPrediction {
  // 1. Elo Model
  const homeRating = FIBA_RANKINGS_2026[homeTeam] ?? 850;
  const awayRating = FIBA_RANKINGS_2026[awayTeam] ?? 850;
  const elo = eloWinProbability(homeRating, awayRating);

  // 2. Four Factors Model
  const homeFourFactors: FourFactorsInput = {
    eFG: homeFeatures.eFG ?? 0.50,
    TOV: homeFeatures.TOV ?? 12,
    ORB: homeFeatures.dREB ?? 25,
    FT: homeFeatures.FT ?? 15,
    ORtg: homeFeatures.offensiveRating ?? 105,
    DRtg: homeFeatures.defensiveRating ?? 100,
    pace: homeFeatures.pace ?? 70,
  };
  const awayFourFactors: FourFactorsInput = {
    eFG: awayFeatures.eFG ?? 0.50,
    TOV: awayFeatures.TOV ?? 12,
    ORB: awayFeatures.dREB ?? 25,
    FT: awayFeatures.FT ?? 15,
    ORtg: awayFeatures.offensiveRating ?? 105,
    DRtg: awayFeatures.defensiveRating ?? 100,
    pace: awayFeatures.pace ?? 70,
  };
  const fourFactors = fourFactorsWinProbability(homeFourFactors, awayFourFactors);

  // 3. PIR Model — simulation de PIR basée sur ORtg/DRtg (pas trueShooting)
  const homePIR = ((homeFeatures.offensiveRating ?? 105) - (homeFeatures.defensiveRating ?? 100)) / 100;
  const awayPIR = ((awayFeatures.offensiveRating ?? 105) - (awayFeatures.defensiveRating ?? 100)) / 100;
  const pir = pirWinProbability(homePIR, awayPIR);

  // 4. XGBoost + SHAP Model
  const xgboost = xgboostPredict(homeFeatures, awayFeatures);

  // 5. Blend pondéré
  const weights = { elo: 0.20, fourFactors: 0.25, pir: 0.15, xgboost: 0.40 };
  const blendedPHome =
    elo.pHome * weights.elo +
    fourFactors.pHome * weights.fourFactors +
    pir.pHome * weights.pir +
    xgboost.pHome * weights.xgboost;

  // 6. Confiance du blend
  const modelStddev = Math.sqrt(
    Math.pow(elo.pHome - blendedPHome, 2) * weights.elo +
    Math.pow(fourFactors.pHome - blendedPHome, 2) * weights.fourFactors +
    Math.pow(pir.pHome - blendedPHome, 2) * weights.pir +
    Math.pow(xgboost.pHome - blendedPHome, 2) * weights.xgboost,
  );
  const blendedConfidence = 1 - modelStddev * 4;

  // 7. Accord des modèles (1 = tous d'accord, 0 = désaccord total)
  const modelValues = [elo.pHome, fourFactors.pHome, pir.pHome, xgboost.pHome];
  const allAbove50 = modelValues.every((p) => p > 0.5);
  const allBelow50 = modelValues.every((p) => p < 0.5);
  const modelAgreement = allAbove50 || allBelow50 ? 1 : 0.5;

  // 8. Recommendation
  const edge = blendedPHome - 0.5;
  const absEdge = Math.abs(edge);
  let recommendation: "HOME" | "AWAY" | "NEUTRAL";
  if (absEdge < 0.05) {
    recommendation = "NEUTRAL";
  } else if (edge > 0) {
    recommendation = "HOME";
  } else {
    recommendation = "AWAY";
  }

  return {
    elo,
    fourFactors,
    pir,
    xgboost: { pHome: xgboost.pHome, confidence: xgboost.confidence },
    blendedPHome,
    blendedConfidence,
    shapValues: xgboost.shapValues,
    featureImportance: xgboost.featureImportance,
    modelAgreement,
    edge,
    recommendation,
  };
}

// ============================================================
// 6. MATCH PREDICTION — Fonction principale
// ============================================================

export type MatchPredictionInput = {
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  restDaysHome?: number;
  restDaysAway?: number;
  // Stats optionnelles (si disponibles)
  homeStats?: Partial<XGBoostFeatures>;
  awayStats?: Partial<XGBoostFeatures>;
};

/**
 * Prédiction complète pour un match FIBA.
 * Utilise le modèle hybride avec toutes les features disponibles.
 */
export function predictMatch(input: MatchPredictionInput): HybridPrediction {
  const homeFeatures: Partial<XGBoostFeatures> = {
    isHome: input.isHome ? 1 : 0,
    restDays: input.restDaysHome ?? 2,
    rankDiff: (FIBA_RANKINGS_2026[input.awayTeam] ?? 850) - (FIBA_RANKINGS_2026[input.homeTeam] ?? 850),
    ...input.homeStats,
  };

  const awayFeatures: Partial<XGBoostFeatures> = {
    isHome: input.isHome ? 0 : 1,
    restDays: input.restDaysAway ?? 2,
    rankDiff: (FIBA_RANKINGS_2026[input.homeTeam] ?? 850) - (FIBA_RANKINGS_2026[input.awayTeam] ?? 850),
    ...input.awayStats,
  };

  return hybridPredict(input.homeTeam, input.awayTeam, homeFeatures, awayFeatures);
}
