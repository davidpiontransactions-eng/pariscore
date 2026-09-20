"use client";

import useSWR from "swr";
import type { FootballMatch } from "@/lib/football-data";

type FootballResponse = {
  matches: FootballMatch[];
  source: string;
  /** true si BSD (source des grandes ligues) n'a rien renvoyé → onglet dégradé. */
  degraded?: boolean;
  updatedAt: string;
};

const fetcher = async (url: string): Promise<FootballResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API football HTTP ${res.status}`);
  return res.json();
};

// /api/football/matches est l'unique source de l'onglet football : BSD (live +
// prématch avec stats/xG complètes) + OpenLigaDB (2. Bundesliga).
// SWR gère la déduplication entre instances + revalidation automatique.
export function useFootballMatches() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<FootballResponse>(
    "/api/football/matches",
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
      errorRetryCount: 2,
    }
  );

  return { data: data ?? null, error, isLoading, isValidating, mutate };
}
