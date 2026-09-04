/**
 * Système de détection de Value Bets pour FIBA Women's WC 2026.
 * 
 * Compare les probabilités du modèle avec les cotes du marché
 * pour identifier les opportunités de value (edge positif).
 */

import { predictMatch, type HybridPrediction } from "./fiba-predictions";

export type MarketOdds = {
  homeOdds: number;    // Cote décimale domicile
  awayOdds: number;    // Cote décimale extérieur
  source: string;      // Bookmaker
  timestamp: string;
};

export type ValueBet = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  
  // Probabilités modèle
  modelHomeProb: number;
  modelAwayProb: number;
  
  // Probabilités marché (dérivées des cotes)
  marketHomeProb: number;
  marketAwayProb: number;
  
  // Cotes
  homeOdds: number;
  awayOdds: number;
  
  // Edge
  homeEdge: number;    // modelHomeProb - marketHomeProb
  awayEdge: number;    // modelAwayProb - marketAwayProb
  
  // Recommandation
  recommendation: "HOME" | "AWAY" | "NONE";
  confidence: number;
  expectedValue: number;  // EV = (prob * odds) - 1
  
  // Kelly Criterion
  kellyFraction: number;  // Fraction optimale du bankroll
  kellyCapped: number;    // Kelly capé à 5%
};

/**
 * Détecte les value bets pour un match donné.
 */
export function detectValueBets(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  odds: MarketOdds,
): ValueBet | null {
  // Prédiction du modèle
  const prediction = predictMatch({
    homeTeam,
    awayTeam,
    isHome: true,
  });

  // Convertir les cotes en probabilités implicites
  const marketHomeProb = 1 / odds.homeOdds;
  const marketAwayProb = 1 / odds.awayOdds;
  
  // Calculer le Vig (margin du bookmaker)
  const vig = (marketHomeProb + marketAwayProb - 1) / 2;
  
  // Probabilités "fair" sans vig
  const fairHomeProb = marketHomeProb - vig;
  const fairAwayProb = marketAwayProb - vig;

  // Calculer les edges
  const homeEdge = prediction.blendedPHome - fairHomeProb;
  const awayEdge = (1 - prediction.blendedPHome) - fairAwayProb;

  // Déterminer la recommandation
  let recommendation: "HOME" | "AWAY" | "NONE" = "NONE";
  let confidence = 0;
  let expectedValue = 0;

  if (homeEdge > 0.03 && homeEdge > awayEdge) {
    recommendation = "HOME";
    confidence = prediction.blendedConfidence;
    expectedValue = (prediction.blendedPHome * odds.homeOdds) - 1;
  } else if (awayEdge > 0.03 && awayEdge > homeEdge) {
    recommendation = "AWAY";
    confidence = prediction.blendedConfidence;
    expectedValue = ((1 - prediction.blendedPHome) * odds.awayOdds) - 1;
  }

  // Kelly Criterion (fraction optimale du bankroll)
  let kellyFraction = 0;
  let kellyCapped = 0;

  if (recommendation === "HOME") {
    const b = odds.homeOdds - 1;  // Net odds
    const p = prediction.blendedPHome;
    const q = 1 - p;
    kellyFraction = (b * p - q) / b;
    kellyCapped = Math.min(Math.max(kellyFraction, 0), 0.05); // Cap à 5%
  } else if (recommendation === "AWAY") {
    const b = odds.awayOdds - 1;
    const p = 1 - prediction.blendedPHome;
    const q = 1 - p;
    kellyFraction = (b * p - q) / b;
    kellyCapped = Math.min(Math.max(kellyFraction, 0), 0.05);
  }

  return {
    matchId,
    homeTeam,
    awayTeam,
    modelHomeProb: prediction.blendedPHome,
    modelAwayProb: 1 - prediction.blendedPHome,
    marketHomeProb: fairHomeProb,
    marketAwayProb: fairAwayProb,
    homeOdds: odds.homeOdds,
    awayOdds: odds.awayOdds,
    homeEdge,
    awayEdge,
    recommendation,
    confidence,
    expectedValue,
    kellyFraction,
    kellyCapped,
  };
}

/**
 * Cotes mock pour démonstration (en production: API Odds)
 */
export const MOCK_ODDS: Record<string, MarketOdds> = {
  "GER-JPN": { homeOdds: 1.65, awayOdds: 2.20, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "ESP-MLI": { homeOdds: 1.10, awayOdds: 6.50, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "FRA-HUN": { homeOdds: 1.45, awayOdds: 2.75, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "NGR-KOR": { homeOdds: 1.80, awayOdds: 2.00, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "AUS-BEL": { homeOdds: 1.35, awayOdds: 3.20, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "PUR-TUR": { homeOdds: 2.10, awayOdds: 1.72, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "USA-CZE": { homeOdds: 1.05, awayOdds: 11.00, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
  "ITA-CHN": { homeOdds: 1.55, awayOdds: 2.40, source: "Mock Bookmaker", timestamp: "2026-09-04T10:00:00Z" },
};

/**
 * Scanne tous les matchs pour détecter les value bets.
 */
export function scanAllValueBets(): ValueBet[] {
  const valueBets: ValueBet[] = [];

  for (const [key, odds] of Object.entries(MOCK_ODDS)) {
    const [home, away] = key.split("-");
    const matchId = `fiba-${home}-${away}`;
    
    const vb = detectValueBets(matchId, home, away, odds);
    if (vb && vb.recommendation !== "NONE") {
      valueBets.push(vb);
    }
  }

  // Trier par expected value décroissant
  return valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
}
