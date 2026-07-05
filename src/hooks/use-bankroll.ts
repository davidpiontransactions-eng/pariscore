"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "setpoint-bankroll";

export type BetStatus = "pending" | "won" | "lost";

export type Bet = {
  id: string;
  matchId: string;
  playerA: string;
  playerB: string;
  betOn: "A" | "B"; // which player the bet is on
  betOnName: string;
  stake: number;
  odd: number;
  status: BetStatus;
  placedAt: string; // ISO
  settledAt?: string; // ISO
  payout?: number; // calculated when settled
  bookmaker?: string;
  // Advanced stats — optional for backward compatibility with bets
  // recorded before this field existed. Populated from the match data
  // (tennis-data.ts TennisMatch.tournament + TennisMatch.stats.surface).
  surface?: string;
  tournament?: string;
};

export type GroupStats = {
  key: string;
  label: string;
  bets: number; // total bets in group (incl. pending)
  won: number;
  lost: number;
  pending: number;
  settled: number; // won + lost
  staked: number; // stakes of settled bets only
  profit: number; // payout - staked (settled only)
  roi: number; // profit / staked * 100 (0 if no settled)
  winRate: number; // won / settled * 100 (0 if no settled)
};

export type AdvancedStats = {
  byBookmaker: GroupStats[];
  byPlayer: GroupStats[];
  byMonth: GroupStats[];
};

export type BankrollState = {
  initial: number; // initial bankroll
  bets: Bet[];
};

const DEFAULT_STATE: BankrollState = {
  initial: 1000,
  bets: [],
};

// Singleton state
let cachedState: BankrollState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<(s: BankrollState) => void>();

function readState(): BankrollState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      initial: typeof parsed.initial === "number" ? parsed.initial : 1000,
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: BankrollState) {
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

function setState(next: BankrollState) {
  cachedState = next;
  writeState(next);
  listeners.forEach((fn) => fn(next));
}

export function useBankroll() {
  const [state, setLocalState] = useState<BankrollState>(cachedState);

  useEffect(() => {
    init();
    if (cachedState !== state) {
      Promise.resolve().then(() => setLocalState(cachedState));
    }
    const listener = (s: BankrollState) => setLocalState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [state]);

  const setInitial = useCallback((amount: number) => {
    setState({ ...cachedState, initial: Math.max(0, amount) });
  }, []);

  const addBet = useCallback(
    (bet: Omit<Bet, "id" | "placedAt" | "status">) => {
      const newBet: Bet = {
        ...bet,
        id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
      return {
        ...b,
        status,
        settledAt: new Date().toISOString(),
        payout,
      };
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

  // Advanced stats — breakdowns by bookmaker / player / month.
  // Profit, ROI and winRate are computed over settled bets only; the
  // `bets`/`pending` counters include pending bets so the user sees the
  // full picture. Tables and charts in BankrollDialog sort by profit desc.
  const advancedStats: AdvancedStats = {
    byBookmaker: computeGroupStats(state.bets, (b) => b.bookmaker?.trim() || "—"),
    byPlayer: computeGroupStats(state.bets, (b) => b.betOnName || "—"),
    byMonth: computeGroupStats(state.bets, (b) => monthKey(b.placedAt)),
  };

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
    advancedStats,
    setInitial,
    addBet,
    settleBet,
    deleteBet,
    clearAll,
  };
}

// --- Advanced stats helpers ------------------------------------------------

/** Build a "YYYY-MM" key from an ISO timestamp. Returns "—" on invalid input. */
function monthKey(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Group bets by a key function and compute per-group stats.
 * Returns groups sorted by profit descending. Pending bets contribute
 * to `bets`/`pending` only; profit/roi/winRate are over settled bets.
 */
function computeGroupStats(
  bets: Bet[],
  getKey: (bet: Bet) => string
): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const bet of bets) {
    const key = getKey(bet);
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: key,
        bets: 0,
        won: 0,
        lost: 0,
        pending: 0,
        settled: 0,
        staked: 0,
        profit: 0,
        roi: 0,
        winRate: 0,
      };
      map.set(key, g);
    }
    g.bets += 1;
    if (bet.status === "pending") {
      g.pending += 1;
    } else {
      g.settled += 1;
      g.staked += bet.stake;
      const payout = bet.payout ?? 0;
      g.profit += payout - bet.stake;
      if (bet.status === "won") g.won += 1;
      else g.lost += 1;
    }
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.roi = g.staked > 0 ? (g.profit / g.staked) * 100 : 0;
    g.winRate = g.settled > 0 ? (g.won / g.settled) * 100 : 0;
  }
  // Sort by profit descending (most profitable first), stable on ties via key.
  groups.sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
  return groups;
}
