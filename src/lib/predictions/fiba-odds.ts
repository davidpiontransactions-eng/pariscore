/**
 * Intégration des cotes pour FIBA Women's WC 2026.
 * 
 * Sources:
 * - The Odds API (gratuit: 500 requêtes/mois)
 * - Simulation réaliste (fallback)
 * 
 * Format: cotes décimales européennes
 */

import { predictMatch } from "./fiba-predictions";

/** Hash déterministe basé sur les noms d'équipes pour seed le RNG */
function deterministicSeed(home: string, away: string): number {
  let hash = 0;
  const str = `${home}-${away}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/** Mulberry32 — PRNG déterministe basé sur un seed */
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type OddsSource = {
  name: string;
  timestamp: string;
  homeOdds: number;
  awayOdds: number;
  spread: number | null;
  total: number | null;
};

export type MatchOdds = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  sources: OddsSource[];
  bestHomeOdds: number;
  bestAwayOdds: number;
  avgHomeOdds: number;
  avgAwayOdds: number;
  vig: number; // margin du bookmaker
};

/**
 * Simule des cotes réalistes basées sur le modèle de prédiction.
 * 
 * En production, on utiliserait The Odds API:
 * GET https://api.the-odds-api.com/v4/sports/basketball_fiba/odds/
 *    ?apiKey=YOUR_KEY
 *    &regions=eu
 *    &markets=h2h
 *    &bookmakers=bet365,pinnacle,williamhill
 */
export function simulateMarketOdds(
  homeTeam: string,
  awayTeam: string,
): MatchOdds {
  // Prédiction du modèle
  const prediction = predictMatch({
    homeTeam,
    awayTeam,
    isHome: true,
  });

  const modelHomeProb = prediction.blendedPHome;

  // RNG déterministe pour des cotes stables entre les refreshes
  const rng = mulberry32(deterministicSeed(homeTeam, awayTeam));

  // Simuler différents bookmakers avec leurs marges
  const bookmakers = [
    { name: "Bet365", vig: 0.05, noise: 0.02 },
    { name: "Pinnacle", vig: 0.02, noise: 0.01 },
    { name: "William Hill", vig: 0.06, noise: 0.03 },
    { name: "Unibet", vig: 0.04, noise: 0.02 },
    { name: "Betfair", vig: 0.03, noise: 0.015 },
  ];

  const sources: OddsSource[] = bookmakers.map((bk) => {
    // Ajouter du bruit réaliste (déterministe)
    const noise = (rng() - 0.5) * bk.noise;
    const adjustedHomeProb = Math.max(0.1, Math.min(0.9, modelHomeProb + noise));
    
    // Calculer les cotes avec vig
    const fairHomeOdds = 1 / adjustedHomeProb;
    const fairAwayOdds = 1 / (1 - adjustedHomeProb);
    
    // Ajouter la margin du bookmaker
    const homeOdds = fairHomeOdds * (1 - bk.vig / 2);
    const awayOdds = fairAwayOdds * (1 - bk.vig / 2);

    return {
      name: bk.name,
      timestamp: new Date().toISOString(),
      homeOdds: Math.round(homeOdds * 100) / 100,
      awayOdds: Math.round(awayOdds * 100) / 100,
      spread: modelHomeProb > 0.5 ? -Math.round((modelHomeProb - 0.5) * 20) : Math.round((0.5 - modelHomeProb) * 20),
      total: 155 + Math.round((Math.random() - 0.5) * 10),
    };
  });

  // Calculer les meilleures cotes et moyennes
  const homeOddsList = sources.map((s) => s.homeOdds);
  const awayOddsList = sources.map((s) => s.awayOdds);

  const bestHomeOdds = Math.max(...homeOddsList);
  const bestAwayOdds = Math.max(...awayOddsList);
  const avgHomeOdds = homeOddsList.reduce((a, b) => a + b, 0) / homeOddsList.length;
  const avgAwayOdds = awayOddsList.reduce((a, b) => a + b, 0) / awayOddsList.length;

  // Calculer le vig moyen
  const avgVig = bookmakers.reduce((sum, bk) => sum + bk.vig, 0) / bookmakers.length;

  return {
    matchId: `${homeTeam}-${awayTeam}`,
    homeTeam,
    awayTeam,
    sources,
    bestHomeOdds,
    bestAwayOdds,
    avgHomeOdds: Math.round(avgHomeOdds * 100) / 100,
    avgAwayOdds: Math.round(avgAwayOdds * 100) / 100,
    vig: Math.round(avgVig * 1000) / 1000,
  };
}

/**
 * Récupère les vraies cotes depuis The Odds API.
 * 
 * Note: Nécessite une clé API (gratuite: 500 requêtes/mois)
 * GET https://api.the-odds-api.com/v4/sports/basketball_fiba/odds/
 */
export async function fetchRealOdds(
  homeTeam: string,
  awayTeam: string,
  apiKey?: string,
): Promise<MatchOdds | null> {
  if (!apiKey) {
    // Fallback sur simulation
    return simulateMarketOdds(homeTeam, awayTeam);
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/basketball_fiba/odds/?apiKey=${apiKey}&regions=eu&markets=h2h`;
    
    const response = await fetch(url, {
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!response.ok) {
      console.error("Odds API error:", response.status);
      return simulateMarketOdds(homeTeam, awayTeam);
    }

    const data = await response.json();
    
    // Parser la réponse The Odds API
    const matchData = data.find((m: any) => {
      const teams = [m.home_team, m.away_team];
      return teams.includes(homeTeam) && teams.includes(awayTeam);
    });

    if (!matchData) {
      return simulateMarketOdds(homeTeam, awayTeam);
    }

    const sources: OddsSource[] = matchData.bookmakers.map((bk: any) => {
      const h2hMarket = bk.markets.find((m: any) => m.key === "h2h");
      if (!h2hMarket) return null;

      const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === matchData.home_team);
      const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === matchData.away_team);

      return {
        name: bk.title,
        timestamp: bk.last_update,
        homeOdds: homeOutcome?.price ?? 0,
        awayOdds: awayOutcome?.price ?? 0,
        spread: null,
        total: null,
      };
    }).filter(Boolean) as OddsSource[];

    if (sources.length === 0) {
      return simulateMarketOdds(homeTeam, awayTeam);
    }

    const homeOddsList = sources.map((s) => s.homeOdds);
    const awayOddsList = sources.map((s) => s.awayOdds);

    return {
      matchId: matchData.id,
      homeTeam,
      awayTeam,
      sources,
      bestHomeOdds: Math.max(...homeOddsList),
      bestAwayOdds: Math.max(...awayOddsList),
      avgHomeOdds: homeOddsList.reduce((a, b) => a + b, 0) / homeOddsList.length,
      avgAwayOdds: awayOddsList.reduce((a, b) => a + b, 0) / awayOddsList.length,
      vig: sources.length > 0 ? 0.05 : 0, // Estimation
    };
  } catch (error) {
    console.error("Failed to fetch odds:", error);
    return simulateMarketOdds(homeTeam, awayTeam);
  }
}

/**
 * Calcule la value d'une cote.
 */
export function calculateValue(
  modelProb: number,
  decimalOdds: number,
): { ev: number; edge: number; isValue: boolean } {
  const impliedProb = 1 / decimalOdds;
  const edge = modelProb - impliedProb;
  const ev = (modelProb * decimalOdds) - 1;

  return {
    ev,
    edge,
    isValue: edge > 0.03, // 3% edge minimum
  };
}

/**
 * Kelly Criterion pour mise optimale.
 */
export function kellyCriterion(
  modelProb: number,
  decimalOdds: number,
  maxFraction: number = 0.05,
): { fraction: number; capped: boolean } {
  const b = decimalOdds - 1;
  const p = modelProb;
  const q = 1 - p;

  const fraction = (b * p - q) / b;
  const capped = fraction > maxFraction;

  return {
    fraction: Math.min(Math.max(fraction, 0), maxFraction),
    capped,
  };
}
