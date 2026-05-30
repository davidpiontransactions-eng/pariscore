// momentumTennis.js — K-Flow + Scaling Momentum Models for Tennis
// Baldwin-McCurdy, Habib, Joseph (2025) — Seattle University
// Predicts in-match momentum shifts from recent point/game data

class KFlowMomentum {
  constructor(windowSize = 18) {
    this.k = windowSize;
  }

  // Compute cumulative k-flow at each point index
  // points: array of { winner: 0|1 } (0=p1 won, 1=p2 won)
  // Returns array of flow values F(i) where positive = p1 momentum
  computeFlow(points) {
    const flow = [];
    for (let i = 0; i < points.length; i++) {
      let sum = 0;
      const start = Math.max(0, i - this.k + 1);
      for (let j = start; j <= i; j++) {
        sum += (points[j].winner === 0 ? 1 : -1);
      }
      flow.push(sum / Math.min(i + 1, this.k)); // normalized -1..1
    }
    return flow;
  }

  // Predict momentum direction for next game
  // Returns { direction: 'p1'|'p2'|'neutral', confidence: 0-1 }
  predictNextGame(points) {
    const flow = this.computeFlow(points);
    if (!flow.length) return { direction: 'neutral', confidence: 0 };
    const lastFlow = flow[flow.length - 1];
    const absF = Math.abs(lastFlow);
    return {
      direction: lastFlow > 0.1 ? 'p1' : lastFlow < -0.1 ? 'p2' : 'neutral',
      confidence: Math.min(absF * 2, 1), // scale to 0-1
      flow: lastFlow,
    };
  }

  // Compute momentum shift magnitude (for alerts)
  // Returns |ΔF| between two recent windows
  computeShift(points, compareWindow = 9) {
    const flow = this.computeFlow(points);
    if (flow.length < compareWindow) return 0;
    const recent = flow.slice(-compareWindow).reduce((a, b) => a + b, 0) / compareWindow;
    const older = flow.slice(-2 * compareWindow, -compareWindow).reduce((a, b) => a + b, 0) / compareWindow;
    return recent - older;
  }
}

class ScalingMomentum {
  constructor(windowSize = 18, serverAdvantage = 0.1835, gameServerAdvantage = 0.35458) {
    this.k = windowSize;
    this.alpha = serverAdvantage;    // point-level server advantage
    this.gamma = gameServerAdvantage; // game-level server advantage
  }

  // Compute SM momentum at each point
  // points: [{ winner: 0|1, server: 0|1, rallyCount: number, gamePoint: bool }]
  // Returns array of SM scores
  computeSMMomentum(points) {
    const scores = [];
    let currentGame = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      
      // Point-level contribution (weighted by rally count)
      const rallyW = p.rallyCount > 0 ? 1 / p.rallyCount : 0.5;
      const pointScore = (p.winner === 0 ? 1 : -1) * rallyW;
      
      // Server advantage correction
      const serverAdj = p.server === 0 ? this.alpha : -this.alpha;
      
      // Game-level: detect game boundaries, accumulate game scores
      if (p.gamePoint) {
        const gameMomentum = (p.winner === 0 ? 1 : -1) * (1 + this.gamma);
        scores.push({ type: 'game', score: gameMomentum, idx: i });
      }
      
      scores.push({
        type: 'point',
        score: pointScore + serverAdj,
        idx: i,
        raw: { winner: p.winner, rallyW, serverAdj, gamePoint: p.gamePoint },
      });
    }
    return scores;
  }

  // Rolling SM score over k-point window
  computeSMFlow(scores) {
    const flow = [];
    for (let i = 0; i < scores.length; i++) {
      let sum = 0, count = 0;
      const start = Math.max(0, i - this.k + 1);
      for (let j = start; j <= i; j++) {
        sum += scores[j].score;
        count++;
      }
      flow.push(count > 0 ? sum / Math.sqrt(count) : 0);
    }
    return flow;
  }

  // Predict next game winner (SM enhanced)
  predictNextGame(points) {
    const scores = this.computeSMMomentum(points);
    const flow = this.computeSMFlow(scores);
    if (!flow.length) return { direction: 'neutral', confidence: 0, flow: 0 };
    const lastFlow = flow[flow.length - 1];
    const absF = Math.abs(lastFlow);
    return {
      direction: lastFlow > 0.15 ? 'p1' : lastFlow < -0.15 ? 'p2' : 'neutral',
      confidence: Math.min(absF * 1.5, 1),
      flow: lastFlow,
    };
  }
}

// ── Tennis Momentum Tracker — integrated with PariScore live data ────────────
class TennisMomentumTracker {
  constructor() {
    this.kfs = new KFlowMomentum(18);
    this.sm = new ScalingMomentum(18);
    this.matchHistory = new Map(); // matchId → pointHistory[]
  }

  // Add a point to a match's history
  addPoint(matchId, pointData) {
    if (!this.matchHistory.has(matchId)) {
      this.matchHistory.set(matchId, []);
    }
    this.matchHistory.get(matchId).push(pointData);
    // Keep last 200 points max
    const hist = this.matchHistory.get(matchId);
    if (hist.length > 200) this.matchHistory.set(matchId, hist.slice(-200));
  }

  // Get current momentum for a match
  getMomentum(matchId) {
    const points = this.matchHistory.get(matchId) || [];
    const kfs = this.kfs.predictNextGame(points);
    const sm = points.length > 0 ? this.sm.predictNextGame(points) : { direction: 'neutral', confidence: 0, flow: 0 };
    const shift = this.kfs.computeShift(points);
    return {
      kfs_direction: kfs.direction,
      kfs_confidence: Math.round(kfs.confidence * 100),
      sm_direction: sm.direction,
      sm_confidence: Math.round(sm.confidence * 100),
      momentum_shift: Math.round(shift * 1000) / 1000,
      points_tracked: points.length,
    };
  }

  // Clear match history (match finished)
  clearMatch(matchId) {
    this.matchHistory.delete(matchId);
  }
}

module.exports = { KFlowMomentum, ScalingMomentum, TennisMomentumTracker };
