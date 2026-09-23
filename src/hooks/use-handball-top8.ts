"use client";

import useSWR from "swr";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

type StrategyEntry = {
  matchId: string;
  league: string;
  kickoff: string;
  home: { name: string; shortName?: string };
  away: { name: string; shortName?: string };
  value: number;
  pick: "home" | "away" | null;
  odds?: { home?: number; draw?: number; away?: number };
  probPct?: number;
  ev?: number | null;
  trend?: number | null;
  formSummary?: { home: string; away: string };
  bestLine?: number;
};

type StrategyResponse = {
  strategies: Record<string, StrategyEntry[]>;
  computedAt: string;
  window: string;
};

/**
 * Top8 stratégies handball.
 * @param strat — filter serveur `?strat=` (fix audit : le hook téléchargeait
 * tout le payload alors que la route exposait déjà le filtre). Le Banker
 * l'appelle sans param → payload complet (2 stratégies+ nécessaires).
 */
export function useHandballTop8(strat?: string) {
  const url = strat
    ? `/api/handball/strategy-top8?strat=${encodeURIComponent(strat)}`
    : "/api/handball/strategy-top8";
  const { data, error, isLoading } = useSWR<StrategyResponse>(
    url,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );

  const matchesFor = (key: string): StrategyEntry[] => data?.strategies?.[key] ?? [];

  return { data, error, isLoading, isReady: !!data, matchesFor };
}
