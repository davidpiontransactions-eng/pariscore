// Snooker Elo Rating System
// Based on Collingwood, Wright & Brooks (2022) research

export interface SnookerEloConfig {
  kFactor: number;          // Default: 32
  initialRating: number;    // Default: 1500
  timeDecayLambda: number;  // Default: 0.005 (exponential decay)
  rollingWindowYears: number; // Default: 2
}

export interface PlayerElo {
  playerId: string;
  rating: number;
  matchesPlayed: number;
  lastUpdated: Date;
}

// Calculate expected win probability
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Update Elo after a match
export function updateElo(
  eloA: PlayerElo,
  eloB: PlayerElo,
  winner: 'A' | 'B',
  config: SnookerEloConfig = { kFactor: 32, initialRating: 1500, timeDecayLambda: 0.005, rollingWindowYears: 2 }
): { newEloA: PlayerElo; newEloB: PlayerElo } {
  const expected = expectedScore(eloA.rating, eloB.rating);
  const actual = winner === 'A' ? 1 : 0;
  
  // Adaptive K-factor: higher for newer players
  const kA = eloA.matchesPlayed < 30 ? config.kFactor * 1.5 : config.kFactor;
  const kB = eloB.matchesPlayed < 30 ? config.kFactor * 1.5 : config.kFactor;
  
  const newRatingA = eloA.rating + kA * (actual - expected);
  const newRatingB = eloB.rating + kB * ((1 - actual) - (1 - expected));
  
  return {
    newEloA: { ...eloA, rating: newRatingA, matchesPlayed: eloA.matchesPlayed + 1, lastUpdated: new Date() },
    newEloB: { ...eloB, rating: newRatingB, matchesPlayed: eloB.matchesPlayed + 1, lastUpdated: new Date() },
  };
}

// Calculate time-decayed weight for a historical result
export function timeDecayWeight(daysAgo: number, lambda: number = 0.005): number {
  return Math.exp(-lambda * daysAgo);
}

// De-vig market odds to get fair probabilities
export function deVigOdds(homeOdds: number, drawOdds: number, awayOdds: number): { home: number; draw: number; away: number } {
  const invH = 1 / homeOdds;
  const invD = 1 / (drawOdds || 100);
  const invA = 1 / awayOdds;
  const total = invH + invD + invA;
  return { home: invH / total, draw: invD / total, away: invA / total };
}

// Calculate edge (model prob vs market implied prob)
export function calculateEdge(modelProb: number, marketOdds: number): number {
  const marketProb = 1 / marketOdds;
  return modelProb - marketProb;
}

// Kelly criterion for optimal stake
export function kellyStake(prob: number, odds: number): number {
  const b = odds - 1;
  const q = 1 - prob;
  return Math.max(0, (b * prob - q) / b);
}

// Convert Elo difference to win probability
export function eloToWinProbability(eloDiff: number): number {
  return 1 / (1 + Math.pow(10, -eloDiff / 400));
}
