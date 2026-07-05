"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * BetSlip — DraftKings-style floating bet slip.
 *
 * A "selection" is a bet the user is composing (no `id`, no `placedAt`, no
 * `status`) — it's NOT yet a `Bet` in the bankroll. The slip accumulates
 * selections across matches, lets the user tune per-selection stakes, and
 * `placeAll()` materialises them by calling `addBet` from `useBankroll` for
 * each one.
 *
 * Singleton pattern mirroring `use-bankroll.ts` / `use-favorites.ts`:
 *  - Module-level `cachedSelections` is the source of truth.
 *  - `init()` reads from localStorage once on first mount and registers a
 *    `storage` event listener for cross-tab sync.
 *  - Each hook instance subscribes via `listeners` and mirrors the cached
 *    state into React state for re-rendering.
 *
 * The `react-hooks/set-state-in-effect` rule is respected: every setState
 * inside an effect is deferred to a microtask via `Promise.resolve().then`,
 * matching the convention used by the other singleton hooks in this project.
 */

const STORAGE_KEY = "setpoint-bet-slip";

/** Hard cap on simultaneous selections — matches the spec (DraftKings-style). */
export const BET_SLIP_MAX = 5;

export type BetSelection = {
  matchId: string;
  playerA: string;
  playerB: string;
  /** Which player this selection is on — "A" or "B". */
  betOn: "A" | "B";
  betOnName: string;
  stake: number;
  odd: number;
  bookmaker?: string;
  /** Optional context captured for advanced bankroll stats — forwarded to
   *  `addBet` when the slip is placed (see STATS-1). */
  surface?: string;
  tournament?: string;
};

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

function readSelections(): BetSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BetSelection[]) : [];
  } catch {
    return [];
  }
}

function writeSelections(sels: BetSelection[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sels));
  } catch {
    /* localStorage may be disabled — silently ignore */
  }
}

let cachedSelections: BetSelection[] = [];
let initialized = false;
const listeners = new Set<(s: BetSelection[]) => void>();

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  cachedSelections = readSelections();
  // Cross-tab sync: another tab updated the slip → re-read and notify.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedSelections = readSelections();
      listeners.forEach((fn) => fn(cachedSelections));
    }
  });
}

function setSelections(next: BetSelection[]) {
  cachedSelections = next;
  writeSelections(next);
  listeners.forEach((fn) => fn(next));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBetSlip() {
  const [selections, setLocalSelections] = useState<BetSelection[]>(
    cachedSelections,
  );

  useEffect(() => {
    init();
    // Sync initial state if not yet initialized. Deferred to a microtask to
    // respect the `react-hooks/set-state-in-effect` rule (same convention
    // as use-bankroll.ts / use-favorites.ts).
    if (cachedSelections !== selections) {
      Promise.resolve().then(() => setLocalSelections(cachedSelections));
    }
    const listener = (s: BetSelection[]) => setLocalSelections(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [selections]);

  /**
   * Add a selection to the slip. Dedupes by `matchId + betOn` — adding the
   * same player on the same match twice is a no-op (returns false).
   * Enforces the BET_SLIP_MAX cap (returns false if full).
   */
  const addToSlip = useCallback((selection: BetSelection): boolean => {
    const dupe = cachedSelections.some(
      (s) => s.matchId === selection.matchId && s.betOn === selection.betOn,
    );
    if (dupe) return false;
    if (cachedSelections.length >= BET_SLIP_MAX) return false;
    setSelections([...cachedSelections, selection]);
    return true;
  }, []);

  /** Remove a single selection identified by `matchId + betOn`. */
  const removeFromSlip = useCallback(
    (matchId: string, betOn: "A" | "B") => {
      setSelections(
        cachedSelections.filter(
          (s) => !(s.matchId === matchId && s.betOn === betOn),
        ),
      );
    },
    [],
  );

  /** Update the stake of a single selection (no-op if not found). */
  const updateStake = useCallback(
    (matchId: string, betOn: "A" | "B", stake: number) => {
      const safe = isNaN(stake) || stake < 0 ? 0 : stake;
      setSelections(
        cachedSelections.map((s) =>
          s.matchId === matchId && s.betOn === betOn
            ? { ...s, stake: safe }
            : s,
        ),
      );
    },
    [],
  );

  /** Remove every selection. */
  const clearSlip = useCallback(() => {
    setSelections([]);
  }, []);

  // Computed totals — derived from the reactive `selections` so UI re-renders
  // immediately on every change.
  const totalStake = selections.reduce((s, x) => s + (x.stake || 0), 0);
  const totalPayout = selections.reduce(
    (s, x) => s + (x.stake || 0) * (x.odd || 0),
    0,
  );
  const totalProfit = totalPayout - totalStake;
  const count = selections.length;
  const isFull = count >= BET_SLIP_MAX;

  return {
    selections,
    count,
    isFull,
    addToSlip,
    removeFromSlip,
    updateStake,
    clearSlip,
    totalStake,
    totalPayout,
    totalProfit,
  };
}
