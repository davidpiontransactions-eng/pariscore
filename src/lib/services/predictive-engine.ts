// Service prédictif football — façade unifiée multi-modèles.
// Combine Poisson, Dixon-Coles, Elo, PowerScore et ensemble pondéré
// en un seul point d'entrée pour les calculs de probabilités et de picks.

import {
  poissonPMF,
  poissonOver,
  buildScoreMatrix,
  marketsFromMatrix,
} from "../prediction/football/poisson";
import {
  buildDixonColesMatrix,
  dixonColesMarkets,
} from "../prediction/football/dixon-coles";
import { eloProb, predictPrematch } from "../prediction/football/engine";
import { round2, clamp01 } from "../prediction/football/math-utils";
import type { Markets } from "../prediction/football/types";

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ────────────────────────────────────────────────────────────────────────────

/** Données d'entrée pour un match à analyser. */
export type MatchInput = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  /** Expected goals domicile (Elo, xG, forme, etc.). */
  lambdaHome: number;
  /** Expected goals extérieur. */
  lambdaAway: number;
  /** Ratings Elo (optionnels — repli sur lambdas si absents). */
  homeElo?: number;
  awayElo?: number;
  /** Cotes bookmaker 1X2 (optionnelles). */
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
    over15?: number;
    over25?: number;
    over35?: number;
    bttsYes?: number;
  };
  /** Forme récente (5 derniers matchs). */
  form?: {
    home: { wins: number; draws: number; losses: number; gf: number; ga: number };
    away: { wins: number; draws: number; losses: number; gf: number; ga: number };
  };
  /** Performance home/away spécifique. */
  homeAway?: {
    homeRecord?: { wins: number; draws: number; losses: number; gp: number };
    awayRecord?: { wins: number; draws: number; losses: number; gp: number };
  };
  /** Confrontations directes. */
  h2h?: { homeWins: number; draws: number; awayWins: number; total: number };
};

// ────────────────────────────────────────────────────────────────────────────
// Types de sortie
// ────────────────────────────────────────────────────────────────────────────

export type MatchProbability = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  models: {
    poisson: { home: number; draw: number; away: number };
    dixonColes: { home: number; draw: number; away: number };
    elo: { home: number; draw: number; away: number };
    powerScore: { home: number; draw: number; away: number };
    ensemble: { home: number; draw: number; away: number };
  };
  markets: {
    over15: number;
    over25: number;
    over35: number;
    bttsYes: number;
  };
  recommendedPick: string;
  probability: number;
  odds: number;
  ev: number;
  confidence: number; // 1-5
};

export type StrategyPick = {
  matchId: string;
  sport: string;
  strategyType: string;
  homeTeam: string;
  awayTeam: string;
  winProbability: number;
  expectedValue: number;
  odds: number;
  confidenceScore: number;
  pick: string;
  edge: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Poids de l'ensemble (configurables)
// ────────────────────────────────────────────────────────────────────────────

type ModelWeights = {
  poisson: number;
  dixonColes: number;
  elo: number;
  powerScore: number;
};

const DEFAULT_WEIGHTS: ModelWeights = {
  poisson: 0.25,
  dixonColes: 0.35,
  elo: 0.2,
  powerScore: 0.2,
};

// ────────────────────────────────────────────────────────────────────────────
// 1. Modèle Poisson — réutilise poisson.ts
// ────────────────────────────────────────────────────────────────────────────

function poissonProbs(lambdaHome: number, lambdaAway: number): Markets {
  return marketsFromMatrix(buildScoreMatrix(lambdaHome, lambdaAway));
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Dixon-Coles — réutilise dixon-coles.ts
// ────────────────────────────────────────────────────────────────────────────

function dixonColesProbs(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = 0.05,
): Markets {
  return dixonColesMarkets(lambdaHome, lambdaAway, rho);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Probabilités Elo — formule standard avec K-factor
// ────────────────────────────────────────────────────────────────────────────

type EloProbs = { home: number; draw: number; away: number };

function eloProbs(
  homeElo: number,
  awayElo: number,
  homeAdv: number = 100,
): EloProbs {
  const pHome = eloProb(homeElo, awayElo, homeAdv);
  // Estimation du draw via le modèle de Maher (λ ≈ 2.7 goals, ~25% draw)
  // P(draw) ≈ 1 - P(home) - P(away) avec correction
  const pAway = 1 - pHome;
  // Draw estimé par Poisson symétrique autour de pHome
  const lambdaH = 2.7 * (0.5 + (pHome - 0.5) * 0.8);
  const lambdaA = 2.7 * (0.5 + (pAway - 0.5) * 0.8);
  const mk = marketsFromMatrix(buildScoreMatrix(lambdaH, lambdaA));
  // On garde home/away du modèle Elo, draw du Poisson dérivé
  return {
    home: round2(pHome * 100),
    draw: round2(mk.draw),
    away: round2(pAway * 100),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. PowerScore — métrique combinée (forme, H/A, H2H)
// ────────────────────────────────────────────────────────────────────────────

type PowerScoreProbs = { home: number; draw: number; away: number };

function powerScoreProbs(input: MatchInput): PowerScoreProbs {
  const { form, homeAway, h2h } = input;

  // Composante forme (poids 0.40)
  let formHome = 0.5;
  let formAway = 0.5;
  if (form) {
    const hN = Math.max(form.home.wins + form.home.draws + form.home.losses, 1);
    const aN = Math.max(form.away.wins + form.away.draws + form.away.losses, 1);
    formHome = (form.home.wins * 3 + form.home.draws) / (hN * 3);
    formAway = (form.away.wins * 3 + form.away.draws) / (aN * 3);
  }

  // Composante home/away (poids 0.30)
  let haHome = 0.5;
  let haAway = 0.5;
  if (homeAway?.homeRecord && homeAway?.awayRecord) {
    const hr = homeAway.homeRecord;
    const ar = homeAway.awayRecord;
    const hrGp = Math.max(hr.gp, 1);
    const arGp = Math.max(ar.gp, 1);
    haHome = (hr.wins * 3 + hr.draws) / (hrGp * 3);
    haAway = (ar.wins * 3 + ar.draws) / (arGp * 3);
  }

  // Composante H2H (poids 0.30)
  let h2hHome = 0.5;
  let h2hAway = 0.5;
  if (h2h && h2h.total > 0) {
    h2hHome = (h2h.homeWins * 3 + h2h.draws) / (h2h.total * 3);
    h2hAway = (h2h.awayWins * 3 + h2h.draws) / (h2h.total * 3);
  }

  // Score combiné normalisé [0, 1]
  const wForm = 0.40;
  const wHA = 0.30;
  const wH2H = 0.30;
  const compositeHome = wForm * formHome + wHA * haHome + wH2H * h2hHome;
  const compositeAway = wForm * formAway + wHA * haAway + wH2H * h2hAway;

  // Conversion en probabilités 1X2 via loi logistique
  const diff = compositeHome - compositeAway;
  const pHome = clamp01(1 / (1 + Math.exp(-4 * diff)));
  const pAway = clamp01(1 / (1 + Math.exp(4 * diff)));
  // Draw = résiduel, borné entre 5% et 35%
  const pDraw = clamp01(1 - pHome - pAway);
  const pDrawBounded = Math.max(0.05, Math.min(0.35, pDraw));

  // Renormalisation
  const total = pHome + pDrawBounded + pAway;
  return {
    home: round2((pHome / total) * 100),
    draw: round2((pDrawBounded / total) * 100),
    away: round2((pAway / total) * 100),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Ensemble — moyenne pondérée de tous les modèles
// ────────────────────────────────────────────────────────────────────────────

function ensembleProbs(
  poisson: { home: number; draw: number; away: number },
  dixonColes: { home: number; draw: number; away: number },
  elo: { home: number; draw: number; away: number },
  powerScore: { home: number; draw: number; away: number },
  weights: ModelWeights = DEFAULT_WEIGHTS,
): { home: number; draw: number; away: number } {
  const home =
    weights.poisson * poisson.home +
    weights.dixonColes * dixonColes.home +
    weights.elo * elo.home +
    weights.powerScore * powerScore.home;
  const draw =
    weights.poisson * poisson.draw +
    weights.dixonColes * dixonColes.draw +
    weights.elo * elo.draw +
    weights.powerScore * powerScore.draw;
  const away =
    weights.poisson * poisson.away +
    weights.dixonColes * dixonColes.away +
    weights.elo * elo.away +
    weights.powerScore * powerScore.away;

  // Renormalisation pour garantir somme = 100
  const total = home + draw + away;
  if (total <= 0) return { home: 33.33, draw: 33.34, away: 33.33 };
  return {
    home: round2((home / total) * 100),
    draw: round2((draw / total) * 100),
    away: round2((away / total) * 100),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. EV Calculator — Expected Value = (probability × odds) - 1
// ────────────────────────────────────────────────────────────────────────────

export function computeEV(probability: number, odds: number): number {
  if (odds <= 1 || !Number.isFinite(odds) || probability <= 0) return -1;
  return round2(probability * odds - 1);
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Top 10 Selector — meilleur pick par stratégie, seuil 60%
// ────────────────────────────────────────────────────────────────────────────

export function selectTop10(
  picks: StrategyPick[],
  minProb: number = 0.60,
): StrategyPick[] {
  return picks
    .filter((p) => p.winProbability >= minProb)
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .slice(0, 10);
}

// ────────────────────────────────────────────────────────────────────────────
// 8. AggregateFromSources — normalise les données multi-sources
// ────────────────────────────────────────────────────────────────────────────

type BSDData = {
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  sport?: string;
  home_score?: number | null;
  away_score?: number | null;
  odds_home?: number | null;
  odds_draw?: number | null;
  odds_away?: number | null;
  odds_over_15?: number | null;
  odds_under_15?: number | null;
  odds_over_25?: number | null;
  odds_under_25?: number | null;
  odds_over_35?: number | null;
  odds_under_35?: number | null;
  odds_btts_yes?: number | null;
  odds_btts_no?: number | null;
  home_team_obj?: { id?: number; short_name?: string } | null;
  away_team_obj?: { id?: number; short_name?: string } | null;
  live_stats?: {
    home?: { corner_kicks?: number };
    away?: { corner_kicks?: number };
  };
};

type FlashscoreData = {
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  sport?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
    over15?: number;
    under15?: number;
    over25?: number;
    under25?: number;
    over35?: number;
    under35?: number;
    bttsYes?: number;
    bttsNo?: number;
  };
};

type PronosData = {
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  sport?: string;
  predictions?: {
    homeWin?: number;
    draw?: number;
    awayWin?: number;
    over15?: number;
    over25?: number;
    bttsYes?: number;
  };
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
};

/**
 * Agrège les données de plusieurs sources (BSD, Flashscore, Pronos) en un
 * MatchInput unifié. Priorité : Pronos > Flashscore > BSD pour les cotes,
 * BSD pour les IDs et noms d'équipes.
 */
export function aggregateFromSources(sources: {
  bsd?: unknown;
  flashscore?: unknown;
  pronos?: unknown;
}): MatchInput {
  const bsd = (sources.bsd ?? {}) as BSDData;
  const flash = (sources.flashscore ?? {}) as FlashscoreData;
  const pronos = (sources.pronos ?? {}) as PronosData;

  // Identifiants et noms — source BSD en priorité
  const matchId = bsd.matchId ?? flash.matchId ?? pronos.matchId ?? `match-${Date.now()}`;
  const homeTeam = bsd.homeTeam ?? flash.homeTeam ?? pronos.homeTeam ?? "Domicile";
  const awayTeam = bsd.awayTeam ?? flash.awayTeam ?? pronos.awayTeam ?? "Extérieur";
  const sport = bsd.sport ?? flash.sport ?? pronos.sport ?? "football";

  // Cotes 1X2 — Pronos en priorité (prédict), puis Flashscore, puis BSD
  const oddsHome = pronos.odds?.home ?? flash.odds?.home ?? bsd.odds_home ?? undefined;
  const oddsDraw = pronos.odds?.draw ?? flash.odds?.draw ?? bsd.odds_draw ?? undefined;
  const oddsAway = pronos.odds?.away ?? flash.odds?.away ?? bsd.odds_away ?? undefined;

  // Cotes marchés — Flashscore en priorité, puis BSD
  const oddsOver15 = flash.odds?.over15 ?? bsd.odds_over_15 ?? undefined;
  const oddsOver25 = flash.odds?.over25 ?? bsd.odds_over_25 ?? undefined;
  const oddsOver35 = flash.odds?.over35 ?? bsd.odds_over_35 ?? undefined;
  const oddsBttsYes = flash.odds?.bttsYes ?? bsd.odds_btts_yes ?? undefined;

  // Estimation des lambdas depuis les cotes (implied probabilities → λ)
  const lambdaHome = estimateLambda(oddsHome, oddsDraw, oddsAway, "home");
  const lambdaAway = estimateLambda(oddsHome, oddsDraw, oddsAway, "away");

  return {
    matchId,
    homeTeam,
    awayTeam,
    sport,
    lambdaHome,
    lambdaAway,
    odds: {
      home: oddsHome,
      draw: oddsDraw,
      away: oddsAway,
      over15: oddsOver15,
      over25: oddsOver25,
      over35: oddsOver35,
      bttsYes: oddsBttsYes,
    },
  };
}

/**
 * Estime λ (expected goals) depuis les cotes 1X2 via implied probabilities.
 * Utilise une heuristique : λ ≈ totalLambda × share, où share = pHome ou pAway.
 */
function estimateLambda(
  oddsHome: number | undefined,
  oddsDraw: number | undefined,
  oddsAway: number | undefined,
  side: "home" | "away",
): number {
  const totalLambda = 2.70;
  if (oddsHome == null || oddsDraw == null || oddsAway == null) return totalLambda / 2;

  const ih = 1 / oddsHome;
  const id = 1 / oddsDraw;
  const ia = 1 / oddsAway;
  const vig = ih + id + ia;
  if (vig <= 0) return totalLambda / 2;

  const pHome = ih / vig;
  const pAway = ia / vig;
  const share = side === "home" ? pHome : pAway;
  // Skew : plus l'équipe est favorisée, plus elle marque (λ)
  const skew = (share - 0.5) * 0.8;
  const adjustedShare = 0.5 + skew;
  return round2(totalLambda * adjustedShare);
}

// ────────────────────────────────────────────────────────────────────────────
// 9. computeProbabilities — fonction principale
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les probabilités d'un match via tous les modèles et retourne
 * un objet MatchProbability unifié avec le pick recommandé.
 */
export function computeProbabilities(input: MatchInput): MatchProbability {
  const { lambdaHome, lambdaAway } = input;

  // 1. Poisson standard
  const mkPoisson = poissonProbs(lambdaHome, lambdaAway);

  // 2. Dixon-Coles (ρ = 0.05, ajuste les bas scores)
  const mkDC = dixonColesProbs(lambdaHome, lambdaAway, 0.05);

  // 3. Elo (si ratings disponibles, sinon repli sur lambdas)
  let eloP: { home: number; draw: number; away: number };
  if (input.homeElo != null && input.awayElo != null) {
    eloP = eloProbs(input.homeElo, input.awayElo);
  } else {
    // Pas d'Elo → utiliser Poisson comme proxy
    eloP = { home: mkPoisson.homeWin, draw: mkPoisson.draw, away: mkPoisson.awayWin };
  }

  // 4. PowerScore
  const psP = powerScoreProbs(input);

  // 5. Ensemble
  const ens = ensembleProbs(
    { home: mkPoisson.homeWin, draw: mkPoisson.draw, away: mkPoisson.awayWin },
    { home: mkDC.homeWin, draw: mkDC.draw, away: mkDC.awayWin },
    eloP,
    psP,
  );

  // Marchés over/btts (Poisson, fiable pour les totaux)
  const markets = {
    over15: round2(mkPoisson.over15),
    over25: round2(mkPoisson.over25),
    over35: round2(mkPoisson.over35),
    bttsYes: round2(mkPoisson.btts),
  };

  // Pick recommandé — meilleur EV parmi 1X2 + marchés
  const pick = findBestPick(ens, markets, input.odds);

  return {
    matchId: input.matchId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    sport: input.sport,
    models: {
      poisson: { home: round2(mkPoisson.homeWin), draw: round2(mkPoisson.draw), away: round2(mkPoisson.awayWin) },
      dixonColes: { home: round2(mkDC.homeWin), draw: round2(mkDC.draw), away: round2(mkDC.awayWin) },
      elo: eloP,
      powerScore: psP,
      ensemble: ens,
    },
    markets,
    recommendedPick: pick.label,
    probability: pick.probability,
    odds: pick.odds,
    ev: pick.ev,
    confidence: computeConfidence(pick.probability, pick.ev),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ────────────────────────────────────────────────────────────────────────────

type PickCandidate = {
  label: string;
  probability: number;
  odds: number;
  ev: number;
};

/**
 * Trouve le meilleur pick (EV max) parmi 1X2 et les marchés over/btts.
 * Requiert au moins une cote pour calculer l'EV.
 */
function findBestPick(
  ensemble: { home: number; draw: number; away: number },
  markets: { over15: number; over25: number; over35: number; bttsYes: number },
  odds?: MatchInput["odds"],
): PickCandidate {
  const candidates: PickCandidate[] = [];

  if (odds?.home && odds.home > 1) {
    const ev = computeEV(ensemble.home / 100, odds.home);
    candidates.push({ label: "1", probability: ensemble.home / 100, odds: odds.home, ev });
  }
  if (odds?.draw && odds.draw > 1) {
    const ev = computeEV(ensemble.draw / 100, odds.draw);
    candidates.push({ label: "X", probability: ensemble.draw / 100, odds: odds.draw, ev });
  }
  if (odds?.away && odds.away > 1) {
    const ev = computeEV(ensemble.away / 100, odds.away);
    candidates.push({ label: "2", probability: ensemble.away / 100, odds: odds.away, ev });
  }
  if (odds?.over15 && odds.over15 > 1) {
    const ev = computeEV(markets.over15 / 100, odds.over15);
    candidates.push({ label: "Over 1.5", probability: markets.over15 / 100, odds: odds.over15, ev });
  }
  if (odds?.over25 && odds.over25 > 1) {
    const ev = computeEV(markets.over25 / 100, odds.over25);
    candidates.push({ label: "Over 2.5", probability: markets.over25 / 100, odds: odds.over25, ev });
  }
  if (odds?.over35 && odds.over35 > 1) {
    const ev = computeEV(markets.over35 / 100, odds.over35);
    candidates.push({ label: "Over 3.5", probability: markets.over35 / 100, odds: odds.over35, ev });
  }
  if (odds?.bttsYes && odds.bttsYes > 1) {
    const ev = computeEV(markets.bttsYes / 100, odds.bttsYes);
    candidates.push({ label: "BTTS Yes", probability: markets.bttsYes / 100, odds: odds.bttsYes, ev });
  }

  // Retourner le candidat avec le meilleur EV, ou un fallback
  if (candidates.length === 0) {
    return { label: "Aucune cote", probability: 0, odds: 0, ev: -1 };
  }
  return candidates.reduce((best, c) => (c.ev > best.ev ? c : best), candidates[0]);
}

/**
 * Confiance (1-5) basée sur la probabilité et l'EV.
 * - 5 : prob > 75% ET EV > 10%
 * - 4 : prob > 70% ET EV > 5%
 * - 3 : prob > 65% ET EV > 0
 * - 2 : prob > 60% ET EV > -5%
 * - 1 : sinon
 */
function computeConfidence(probability: number, ev: number): number {
  if (probability > 0.75 && ev > 0.10) return 5;
  if (probability > 0.70 && ev > 0.05) return 4;
  if (probability > 0.65 && ev > 0) return 3;
  if (probability > 0.60 && ev > -0.05) return 2;
  return 1;
}
