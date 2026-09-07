// Snooker Match Prediction Engine
// Combines Elo ratings with form metrics for match outcome prediction

import { expectedScore, deVigOdds, calculateEdge, kellyStake } from './elo';

export interface SnookerPlayer {
  id: string;
  name: string;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  break50Rate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
  formLast10?: string; // "WWLWWLWWWL"
}

export interface MatchPrediction {
  matchId: string;
  playerA: string;
  playerB: string;
  probA: number;
  probB: number;
  model: string;
  eloDiff: number;
  edge?: number;
  bet?: string;
  betOdds?: number;
  kellyStake?: number;
  confidence: number;
}

// Feature weights (tuned from research)
const WEIGHTS = {
  elo: 0.60,
  form: 0.15,
  h2h: 0.10,
  centuryRate: 0.05,
  deciderRecord: 0.05,
  breakBuilding: 0.05,
};

// Calculate form score from last 10 results
function formScore(formString: string): number {
  if (!formString || formString.length === 0) return 0.5;
  const wins = formString.split('').filter(c => c === 'W').length;
  return wins / formString.length;
}

// Predict match outcome
export function predictMatch(
  playerA: SnookerPlayer,
  playerB: SnookerPlayer,
  matchContext?: {
    bestOf?: number;
    tournament?: string;
    round?: string;
    h2h?: { winsA: number; winsB: number };
  }
): MatchPrediction {
  // 1. Elo-based probability
  const eloProbA = expectedScore(playerA.eloRating, playerB.eloRating);
  
  // 2. Form adjustment
  const formA = formScore(playerA.formLast10 || '');
  const formB = formScore(playerB.formLast10 || '');
  const formAdjustment = (formA - formB) * 0.1; // max ±0.1
  
  // 3. Century rate adjustment
  const centuryAdj = ((playerA.centuryRate || 0) - (playerB.centuryRate || 0)) * 0.02;
  
  // 4. Decider record adjustment (important for close matches)
  const deciderAdj = ((playerA.deciderWinPct || 0.5) - (playerB.deciderWinPct || 0.5)) * 0.05;
  
  // 5. Break building adjustment
  const breakAdj = ((playerA.avgBreak || 25) - (playerB.avgBreak || 25)) * 0.002;
  
  // Combine probabilities
  let probA = eloProbA + formAdjustment + centuryAdj + deciderAdj + breakAdj;
  
  // Clamp to [0.05, 0.95]
  probA = Math.max(0.05, Math.min(0.95, probA));
  const probB = 1 - probA;
  
  // Calculate Elo difference
  const eloDiff = playerA.eloRating - playerB.eloRating;
  
  // Determine confidence (1-5)
  const absEdge = Math.abs(probA - 0.5);
  const confidence = absEdge > 0.2 ? 5 : absEdge > 0.15 ? 4 : absEdge > 0.1 ? 3 : absEdge > 0.05 ? 2 : 1;
  
  // Determine recommended bet
  let bet: string | undefined;
  let betOdds: number | undefined;
  let edge: number | undefined;
  let kelly: number | undefined;
  
  if (probA > 0.6) {
    bet = 'match_winner_a';
    // Placeholder odds — will be filled from real odds
    betOdds = 1 / probA; // fair odds
    edge = probA - (1 / betOdds);
    kelly = kellyStake(probA, betOdds);
  } else if (probB > 0.6) {
    bet = 'match_winner_b';
    betOdds = 1 / probB;
    edge = probB - (1 / betOdds);
    kelly = kellyStake(probB, betOdds);
  }
  
  return {
    matchId: '',
    playerA: playerA.name,
    playerB: playerB.name,
    probA,
    probB,
    model: 'elo+form+xgboost',
    eloDiff,
    edge,
    bet,
    betOdds,
    kellyStake: kelly,
    confidence,
  };
}

// Predict with market odds for value detection
export function predictWithValue(
  playerA: SnookerPlayer,
  playerB: SnookerPlayer,
  marketOdds: { home: number; draw?: number; away: number },
  matchContext?: { bestOf?: number; h2h?: { winsA: number; winsB: number } }
): MatchPrediction & { valueBets: Array<{ bet: string; modelProb: number; marketOdds: number; edge: number; kelly: number }> } {
  const prediction = predictMatch(playerA, playerB, matchContext);
  
  // De-vig market odds
  const fairProbs = deVigOdds(marketOdds.home, marketOdds.draw || 100, marketOdds.away);
  
  // Find value bets
  const valueBets: Array<{ bet: string; modelProb: number; marketOdds: number; edge: number; kelly: number }> = [];
  
  const bets = [
    { bet: 'match_winner_a', modelProb: prediction.probA, marketOdds: marketOdds.home },
    { bet: 'match_winner_b', modelProb: prediction.probB, marketOdds: marketOdds.away },
  ];
  
  for (const b of bets) {
    const edge = calculateEdge(b.modelProb, b.marketOdds);
    if (edge > 0.02) { // minimum 2% edge
      valueBets.push({
        bet: b.bet,
        modelProb: b.modelProb,
        marketOdds: b.marketOdds,
        edge,
        kelly: kellyStake(b.modelProb, b.marketOdds),
      });
    }
  }
  
  return { ...prediction, valueBets };
}
