"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook pour collecter l'historique des odds d'un match sur le client.
 * Les snapshots sont stockés dans localStorage (clé: odds_history_{matchId}).
 * Max 20 points, intervalle configurable (défaut: 5 min).
 *
 * Utilisation :
 * const oddsHistory = useOddsHistory(matchId, currentOddsA, currentOddsB);
 * <OddsSparkline dataA={oddsHistory.map(o => o.a)} dataB={oddsHistory.map(o => o.b)} />
 */

type OddsSnapshot = {
  a: number;
  b: number;
  ts: number; // timestamp ms
};

const MAX_POINTS = 20;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const STORAGE_PREFIX = "odds_history_";

function getStorageKey(matchId: string): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

function loadHistory(matchId: string): OddsSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(matchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_POINTS) : [];
  } catch {
    return [];
  }
}

function saveHistory(matchId: string, history: OddsSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(matchId), JSON.stringify(history.slice(-MAX_POINTS)));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

export function useOddsHistory(
  matchId: string | undefined,
  currentA: number | undefined,
  currentB: number | undefined,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): OddsSnapshot[] {
  const [history, setHistory] = useState<OddsSnapshot[]>([]);
  const lastRecordedRef = useRef<number>(0);

  // Charger l'historique existant au montage
  useEffect(() => {
    if (!matchId) return;
    setHistory(loadHistory(matchId));
  }, [matchId]);

  // Enregistrer un snapshot quand les odds changent
  useEffect(() => {
    if (!matchId || currentA == null || currentB == null) return;

    const now = Date.now();
    const timeSinceLastRecord = now - lastRecordedRef.current;

    // Enregistrer si :
    // - Premier enregistrement (lastRecordedRef = 0)
    // - Odds ont changé depuis le dernier snapshot
    // - Interval minimum respecté
    const lastSnapshot = history[history.length - 1];
    const oddsChanged = !lastSnapshot || lastSnapshot.a !== currentA || lastSnapshot.b !== currentB;
    const intervalPassed = timeSinceLastRecord >= intervalMs;

    if (oddsChanged || intervalPassed) {
      const snapshot: OddsSnapshot = { a: currentA, b: currentB, ts: now };
      const newHistory = [...history, snapshot].slice(-MAX_POINTS);
      setHistory(newHistory);
      saveHistory(matchId, newHistory);
      lastRecordedRef.current = now;
    }
  }, [currentA, currentB, matchId, history, intervalMs]);

  // Nettoyage: supprimer les entrées vieilles de 24h
  useEffect(() => {
    if (!matchId || history.length === 0) return;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = history.filter((s) => s.ts > cutoff);
    if (filtered.length < history.length) {
      setHistory(filtered);
      saveHistory(matchId, filtered);
    }
  }, [matchId, history]);

  return history;
}

/**
 * Nettoyer tout l'historique odds (debug/settings).
 */
export function clearAllOddsHistory(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
