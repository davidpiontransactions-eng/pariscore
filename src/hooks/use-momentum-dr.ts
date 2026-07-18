"use client";

import { useRef } from "react";
import type { LiveMatchState } from "@/hooks/use-live-matches";

// ─── Configuration ─────────────────────────────────────────────────────────
//
// The algorithm is inspired by Wang, Chen & Sabir (2025):
//   "Tennis Game Dynamic Prediction Model Based on Players' Momentum"
//   AppliedMath 2025, 5(3), 77 — https://doi.org/10.3390/appliedmath5030077
//
// Core formula:
//   leverage(t) = ΔP_win after point outcome
//   momentum(t) = EWMA(leverage, α)
//   DR = P1_momentum / (P1_momentum + P2_momentum) → [-1, +1] balance
//
// We simplify for real-time SSE data:
//   • Rolling buffer of last N points
//   • Each point weighted by recency (exponential decay, λ=0.85)
//   • Break points / serve points get bonus weight (×1.5 per paper findings)
//   • Smoothing via EWMA with configurable α

const WINDOW_SIZE = 24; // Derniers 24 points (~2 jeux en moyenne)
const ALPHA = 0.45; // EWMA smoothing factor (paper uses ~0.35–0.45 for real-time)
const BREAK_WEIGHT = 1.5; // Multiplicateur pour points de break (SHAP-confirmed)
const SERVE_WEIGHT = 1.0; // Baseline serve (le serveur a l'avantage)
const RECEIVE_WEIGHT = 1.35; // Receveur qui gagne le point = +poids (break/surprise)

// ─── Types ──────────────────────────────────────────────────────────────────

export type PointOutcome = {
  /** 'A' or 'B': which player won the point */
  winner: "A" | "B";
  /** 'A' or 'B': which player was serving */
  server: "A" | "B";
  /** Whether this point was a break point opportunity */
  wasBreakPoint: boolean;
  /** Set number (1-based) */
  set: number;
  /** Game number within the set (1-based) */
  game: number;
  /** Timestamp (monotonic counter) */
  tick: number;
};

export type MomentumDRResult = {
  /** P1 momentum score (0–100 scale) */
  momentumA: number;
  /** P2 momentum score (0–100 scale) */
  momentumB: number;
  /** Dominance Ratio: -1 (P2 total) → +1 (P1 total). 0 = even. */
  dr: number;
  /** Number of points tracked in buffer */
  pointsTracked: number;
  /** Current server */
  server: "A" | "B";
  /** Whether enough points have been tracked for a meaningful reading */
  settled: boolean;
  /** History arrays for chart rendering */
  pointHistory: PointOutcome[];
  /** Previous DR values for smooth transitions */
  drHistory: number[];
  /** Current set number */
  currentSet: number;
  /** Which player won each set so far: 'A' | 'B' | null per set index */
  setWinners: (string | null)[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect point outcomes by diffing two consecutive LiveMatchState snapshots.
 * Returns an array of inferred PointOutcomes since the last tick.
 *
 * Handles:
 *   • Normal point progression (0→15, 15→30, 30→40)
 *   • Deuce transitions (40-40 → Avantage)
 *   • Game wins (point resets to 0-0, games increment)
 *   • Set wins (games reset, sets increment)
 *   • Tiebreak special case (points go 0..7+)
 */
function diffPoints(
  prev: LiveMatchState | null,
  curr: LiveMatchState,
): PointOutcome[] {
  if (!prev) return [];
  if (prev.matchId !== curr.matchId) return [];

  const outcomes: PointOutcome[] = [];
  const server = curr.server;

  // Track current set and game
  const currentSetNum = (curr.currentSet || 0) + 1;
  const currentGameNum = (curr.scoreA.games + curr.scoreB.games) + 1;

  // Helper: determine if a point is a break opportunity.
  // Break point = receiver is at 0, 15, or 30 and server at 40,
  // OR deuce (both >= 3) and receiver has advantage.
  const isBreakPoint = (ptsA: number, ptsB: number, svr: "A" | "B"): boolean => {
    if (svr === "B") {
      // A receiving → break point if A is close to winning
      if (ptsA >= 3 && ptsB <= 2) return true; // 40-x or Av-40
      if (ptsA >= 3 && ptsB >= 3 && ptsA > ptsB) return true; // Av-40 after deuce
      return false;
    } else {
      // B receiving → break point if B is close to winning
      if (ptsB >= 3 && ptsA <= 2) return true;
      if (ptsA >= 3 && ptsB >= 3 && ptsB > ptsA) return true;
      return false;
    }
  };

  // Detect if a game ended (points reset to 0-0)
  // We need to track previous game state to infer point wins.
  // Strategy: compare composite scores and simulate point-by-point.

  const pA = { sets: [...prev.scoreA.sets], games: prev.scoreA.games, points: prev.scoreA.points };
  const pB = { sets: [...prev.scoreB.sets], games: prev.scoreB.games, points: prev.scoreB.points };
  const cA = curr.scoreA;
  const cB = curr.scoreB;

  // To handle set boundaries: if the set count changed, normalize
  // by adjusting the games. But we actually need to just track
  // the raw score progression.

  // Build a composite score: (sets_won, games_in_current_set, points)
  // We'll simulate advancing point-by-point until we reach the current score.
  const MAX_POINTS = 6; // safety limit: max points we expect between ticks

  // Track simulated state
  let sA = { ...pA };
  let sB = { ...pB };
  const sCurrA = { sets: [...cA.sets], games: cA.games, points: cA.points };
  const sCurrB = { sets: [...cB.sets], games: cB.games, points: cB.points };

  // Track game and set during simulation
  let simSetNum = currentSetNum;
  let simGameNum = currentGameNum;

  for (let i = 0; i < MAX_POINTS; i++) {
    // Check if we've arrived
    if (
      sA.games === sCurrA.games &&
      sA.points === sCurrA.points &&
      sA.sets.length === sCurrA.sets.length &&
      sA.sets.every((v, j) => v === sCurrA.sets[j]) &&
      sB.games === sCurrB.games &&
      sB.points === sCurrB.points &&
      sB.sets.length === sCurrB.sets.length &&
      sB.sets.every((v, j) => v === sCurrB.sets[j])
    ) {
      break;
    }

    // Determine who wins the imaginary next point.
    const tryPoint = (winner: "A" | "B"): { newA: typeof sA; newB: typeof sB } | null => {
      const na = { ...sA };
      const nb = { ...sB };

      if (winner === "A") {
        na.points += 1;
      } else {
        nb.points += 1;
      }

      const isTiebreak = na.games === 6 && nb.games === 6;

      if (isTiebreak) {
        if (na.points >= 7 && na.points - nb.points >= 2) {
          na.games += 1; na.points = 0; nb.points = 0;
          if (na.games >= 6 && na.games - nb.games >= 2) {
            na.sets = [...na.sets, na.games]; nb.sets = [...nb.sets, nb.games];
            na.games = 0; nb.games = 0;
          }
        } else if (nb.points >= 7 && nb.points - na.points >= 2) {
          nb.games += 1; na.points = 0; nb.points = 0;
          if (nb.games >= 6 && nb.games - na.games >= 2) {
            na.sets = [...na.sets, nb.games]; nb.sets = [...nb.sets, na.games];
            na.games = 0; nb.games = 0;
          }
        }
      } else {
        if (na.points >= 4 && na.points - nb.points >= 2) {
          na.games += 1; na.points = 0; nb.points = 0;
          if (na.games >= 6 && na.games - nb.games >= 2) {
            na.sets = [...na.sets, na.games]; nb.sets = [...nb.sets, nb.games];
            na.games = 0; nb.games = 0;
          }
        } else if (nb.points >= 4 && nb.points - na.points >= 2) {
          nb.games += 1; na.points = 0; nb.points = 0;
          if (nb.games >= 6 && nb.games - na.games >= 2) {
            na.sets = [...na.sets, nb.games]; nb.sets = [...nb.sets, na.games];
            na.games = 0; nb.games = 0;
          }
        }
      }

      const dist = (a: typeof sA, tA: typeof sCurrA) =>
        Math.abs(a.games - tA.games) + Math.abs(a.points - tA.points) +
        Math.abs(a.sets.length - tA.sets.length);

      const distA = dist(na, sCurrA) + dist(nb, sCurrB);
      const distPrev = dist(sA, sCurrA) + dist(sB, sCurrB);

      if (distA < distPrev) return { newA: na, newB: nb };
      return null;
    };

    const resultA = tryPoint("A");
    if (resultA) {
      const wasBp = server !== "A" && isBreakPoint(sA.points, sB.points, server);
      outcomes.push({ winner: "A", server, wasBreakPoint: wasBp, set: simSetNum, game: simGameNum, tick: i });
      if (resultA.newA.games !== sA.games || resultA.newB.games !== sB.games) {
        simGameNum++;
        if (resultA.newA.sets.length > sA.sets.length || resultA.newB.sets.length > sB.sets.length) {
          simSetNum++; simGameNum = 1;
        }
      }
      sA = resultA.newA;
      sB = resultA.newB;
      continue;
    }

    const resultB = tryPoint("B");
    if (resultB) {
      const wasBp = server !== "B" && isBreakPoint(sA.points, sB.points, server);
      outcomes.push({ winner: "B", server, wasBreakPoint: wasBp, set: simSetNum, game: simGameNum, tick: i });
      if (resultB.newA.games !== sA.games || resultB.newB.games !== sB.games) {
        simGameNum++;
        if (resultB.newA.sets.length > sA.sets.length || resultB.newB.sets.length > sB.sets.length) {
          simSetNum++; simGameNum = 1;
        }
      }
      sA = resultB.newA;
      sB = resultB.newB;
      continue;
    }

    // If neither fits, bail out
    break;
  }

  return outcomes;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * `useMomentumDR` — Real-time momentum tracking for tennis live matches.
 *
 * Implements a simplified version of the Wang, Chen & Sabir (2025) momentum
 * quantification algorithm for SSE-fed live match data.
 *
 * @param liveState — Current LiveMatchState from the SSE `live_patch` stream.
 * @returns {MomentumDRResult} — Normalized momentum scores and dominance ratio.
 */
export function useMomentumDR(
  liveState: LiveMatchState | undefined,
): MomentumDRResult {
  // Use refs to persist the buffer across renders without re-rendering on every point.
  const bufferRef = useRef<PointOutcome[]>([]);
  const prevStateRef = useRef<LiveMatchState | null>(null);
  const tickRef = useRef(0);
  const settledRef = useRef(false);

  // We need to process state changes in render (since hooks can't have
  // conditional effects based on changed values without deep comparison).
  // We use refs to avoid re-render loops and only expose computed values.

  // If we have a new state, diff it with the previous one
  if (liveState && liveState !== prevStateRef.current) {
    // Clear buffer on match ID change to avoid stale-data pollution
    if (prevStateRef.current && liveState.matchId !== prevStateRef.current.matchId) {
      bufferRef.current = [];
      tickRef.current = 0;
      settledRef.current = false;
    }

    const outcomes = diffPoints(prevStateRef.current, liveState);
    prevStateRef.current = liveState;

    if (outcomes.length > 0) {
      tickRef.current += 1;

      // Add all detected points to buffer, with proper tick stamps
      for (const outcome of outcomes) {
        bufferRef.current.push({
          ...outcome,
          tick: tickRef.current,
        });
      }

      // Trim buffer to window size
      if (bufferRef.current.length > WINDOW_SIZE) {
        bufferRef.current = bufferRef.current.slice(-WINDOW_SIZE);
      }

      // Settle after at least 4 points
      if (bufferRef.current.length >= 4) {
        settledRef.current = true;
      }
    }
  }

  const buffer = bufferRef.current;
  const settled = settledRef.current;
  const server = liveState?.server ?? "A";

  const currentSet = (liveState?.currentSet ?? 0) + 1;
  const setWinners: (string | null)[] = [];
  if (liveState) {
    const maxSets = Math.max(liveState.scoreA.sets.length, liveState.scoreB.sets.length);
    for (let i = 0; i < maxSets; i++) {
      const a = liveState.scoreA.sets[i] ?? 0;
      const b = liveState.scoreB.sets[i] ?? 0;
      setWinners.push(a > b ? "A" : b > a ? "B" : null);
    }
  }

  // Calculate EWWA-weighted momentum scores
  if (buffer.length === 0 || !settled) {
    return {
      momentumA: 50,
      momentumB: 50,
      dr: 0,
      pointsTracked: buffer.length,
      pointHistory: [],
      drHistory: [],
      currentSet,
      setWinners,
      server,
      settled: false,
    };
  }

  // Apply exponential decay weights (recent points matter more)
  // and context weights (break points, serve/receive).
  let weightedA = 0;
  let weightedB = 0;
  let totalWeight = 0;

  for (let i = 0; i < buffer.length; i++) {
    const pt = buffer[i];
    const age = buffer.length - 1 - i; // 0 = most recent
    const recencyWeight = Math.pow(0.88, age); // ~0.88 decay factor per point

    // Context weight
    let contextWeight = 1.0;
    if (pt.wasBreakPoint) {
      contextWeight = BREAK_WEIGHT; // Break points are momentum-defining
    } else if (pt.server === pt.winner) {
      contextWeight = SERVE_WEIGHT; // Holding serve = expected, baseline
    } else {
      contextWeight = RECEIVE_WEIGHT; // Breaking serve = significant momentum shift
    }

    const w = recencyWeight * contextWeight;
    totalWeight += w;

    if (pt.winner === "A") {
      weightedA += w;
    } else {
      weightedB += w;
    }
  }

  if (totalWeight === 0) {
    return {
      momentumA: 50,
      momentumB: 50,
      dr: 0,
      pointsTracked: buffer.length,
      pointHistory: buffer,
      drHistory: [],
      currentSet,
      setWinners,
      server,
      settled: true,
    };
  }

  const rawA = weightedA / totalWeight; // 0–1
  const rawB = weightedB / totalWeight; // 0–1
  const momentumA = Math.round(rawA * 100);
  const momentumB = Math.round(rawB * 100);

  // Dominance Ratio: -1 (P2 total dominance) to +1 (P1 total dominance)
  // Smooth with tanh to avoid extreme swings on small buffers
  const dr = Math.tanh((rawA - rawB) * 2.5);
  const drHistory = buffer.map((_, i) => {
    let wA = 0, wB = 0, tw = 0;
    for (let j = 0; j <= i; j++) {
      const pt = buffer[j];
      const age = i - j;
      const rw = Math.pow(0.88, age);
      let cw = 1.0;
      if (pt.wasBreakPoint) cw = BREAK_WEIGHT;
      else if (pt.server === pt.winner) cw = SERVE_WEIGHT;
      else cw = RECEIVE_WEIGHT;
      const w = rw * cw;
      tw += w;
      if (pt.winner === "A") wA += w; else wB += w;
    }
    if (tw === 0) return 0;
    return Math.tanh((wA / tw - wB / tw) * 2.5);
  });

  return {
    momentumA,
    momentumB,
    dr: Math.round(dr * 1000) / 1000,
    drHistory,
    pointHistory: buffer,
    pointsTracked: buffer.length,
    currentSet,
    setWinners,
    server,
    settled: true,
  };
}
