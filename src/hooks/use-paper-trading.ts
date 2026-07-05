"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "setpoint-paper-trading";

export type PaperBetStatus = "pending" | "won" | "lost";

export type PaperBet = {
  id: string;
  matchId: string;
  playerA: string;
  playerB: string;
  betOn: "A" | "B";
  betOnName: string;
  stake: number; // virtual currency (points, not €)
  odd: number;
  status: PaperBetStatus;
  placedAt: string;
  settledAt?: string;
  payout?: number;
  bookmaker?: string;
  surface?: string;
  tournament?: string;
};

export type PaperTradingState = {
  initial: number; // starting virtual bankroll (default 10,000 points)
  bets: PaperBet[];
};

const DEFAULT_STATE: PaperTradingState = {
  initial: 10000,
  bets: [],
};

let cachedState: PaperTradingState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<(s: PaperTradingState) => void>();

function readState(): PaperTradingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      initial: typeof parsed.initial === "number" ? parsed.initial : 10000,
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: PaperTradingState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  cachedState = readState();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedState = readState();
      listeners.forEach((fn) => fn(cachedState));
    }
  });
}

function setState(next: PaperTradingState) {
  cachedState = next;
  writeState(next);
  listeners.forEach((fn) => fn(next));
}

export function usePaperTrading() {
  const [state, setLocalState] = useState<PaperTradingState>(cachedState);

  useEffect(() => {
    init();
    if (cachedState !== state) {
      Promise.resolve().then(() => setLocalState(cachedState));
    }
    const listener = (s: PaperTradingState) => setLocalState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [state]);

  const setInitial = useCallback((amount: number) => {
    setState({ ...cachedState, initial: Math.max(0, amount) });
  }, []);

  const addBet = useCallback(
    (bet: Omit<PaperBet, "id" | "placedAt" | "status">) => {
      const newBet: PaperBet = {
        ...bet,
        id: `paper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        placedAt: new Date().toISOString(),
        status: "pending",
      };
      setState({ ...cachedState, bets: [newBet, ...cachedState.bets] });
      return newBet.id;
    },
    []
  );

  const settleBet = useCallback((betId: string, status: "won" | "lost") => {
    const bets = cachedState.bets.map((b) => {
      if (b.id !== betId) return b;
      const payout = status === "won" ? b.stake * b.odd : 0;
      return { ...b, status, settledAt: new Date().toISOString(), payout };
    });
    setState({ ...cachedState, bets });
  }, []);

  const deleteBet = useCallback((betId: string) => {
    setState({ ...cachedState, bets: cachedState.bets.filter((b) => b.id !== betId) });
  }, []);

  const clearAll = useCallback(() => {
    setState({ ...cachedState, bets: [] });
  }, []);

  // Computed stats
  const settledBets = state.bets.filter((b) => b.status !== "pending");
  const pendingBets = state.bets.filter((b) => b.status === "pending");
  const wonBets = state.bets.filter((b) => b.status === "won");
  const lostBets = state.bets.filter((b) => b.status === "lost");
  const totalStaked = settledBets.reduce((s, b) => s + b.stake, 0);
  const totalReturned = settledBets.reduce((s, b) => s + (b.payout ?? 0), 0);
  const profit = totalReturned - totalStaked;
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0;
  const currentBankroll = state.initial + profit;

  return {
    state,
    bets: state.bets,
    settledBets,
    pendingBets,
    wonBets,
    lostBets,
    stats: {
      initial: state.initial,
      current: currentBankroll,
      profit,
      roi,
      winRate,
      totalBets: state.bets.length,
      settledCount: settledBets.length,
      pendingCount: pendingBets.length,
      wonCount: wonBets.length,
      lostCount: lostBets.length,
      totalStaked,
      totalReturned,
    },
    setInitial,
    addBet,
    settleBet,
    deleteBet,
    clearAll,
  };
}
