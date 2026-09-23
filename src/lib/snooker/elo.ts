// Snooker Elo Rating System
// Based on Collingwood, Wright & Brooks (2022) research

// Calculate expected win probability
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
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
