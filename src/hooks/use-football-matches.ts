"use client";

import { useState, useEffect, useCallback } from "react";
import type { FootballMatch } from "@/lib/football-data";

type FootballResponse = {
  matches: FootballMatch[];
  source: string;
  /** true si BSD (source des grandes ligues) n'a rien renvoyé → onglet dégradé. */
  degraded?: boolean;
  updatedAt: string;
};

const POLL_INTERVAL_MS = 60_000;

// /api/football/matches est l'unique source de l'onglet football : BSD (live +
// prématch avec stats/xG complètes) + OpenLigaDB (2. Bundesliga).
// Plus aucun mock (ALL_FOOTBALL_MATCHES) ni fallback v2 Prisma, dont les
// seeds mock_fl2 polluaient l'onglet avec des matchs fictifs.
export function useFootballMatches() {
  const [data, setData] = useState<FootballResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const fetchMatches = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/football/matches");
      if (!res.ok) {
        // Keep last good data or empty - don't throw to error boundary
        // The degraded banner will handle "limited source" display
        const json: FootballResponse = await res.json();
        if ((json.matches ?? []).length === 0 && !json.degraded) {
          // Empty API response, not a hard error - just clear data
          setData(json);
          setIsLoading(false);
          setIsValidating(false);
          return;
        }
        throw new Error(`API football HTTP ${res.status}`);
      }
      const json: FootballResponse = await res.json();
      // Dégradé (BSD vide) ≠ erreur : on ne casse pas l'onglet, on laisse le
      // bandeau « source limitée » + l'état vide s'afficher.
      if ((json.matches ?? []).length === 0 && !json.degraded) {
        setData(json);
      } else {
        setData(json);
      }
    } catch (err) {
      // Only set error for truly unexpected failures, not API empty responses
      if (err instanceof Error && err.message !== "API football vide") {
        setError(err instanceof Error ? err : new Error("API football indisponible"));
      } else {
        // Empty response - just clear data, don't set error
        setData(null);
      }
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { data, error, isLoading, isValidating, mutate: fetchMatches };
}