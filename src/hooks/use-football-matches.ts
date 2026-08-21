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
      if (!res.ok) throw new Error(`API football HTTP ${res.status}`);
      const json: FootballResponse = await res.json();
      // Dégradé (BSD vide) ≠ erreur : on ne casse pas l'onglet, on laisse le
      // bandeau « source limitée » + l'état vide s'afficher.
      if ((json.matches ?? []).length === 0 && !json.degraded) throw new Error("API football vide");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("API football indisponible"));
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