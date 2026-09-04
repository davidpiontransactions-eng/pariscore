"use client";

import useSWR from "swr";
import type { MatchOdds } from "@/lib/predictions/fiba-odds";

const REFRESH_OPTS = {
  refreshInterval: 60_000, // 1 min pour les cotes
  revalidateOnFocus: true,
  errorRetryCount: 2,
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export type FibaOddsData = {
  odds: MatchOdds;
  source: string;
};

export function useFibaOdds(homeTeam: string | null, awayTeam: string | null) {
  const { data, isLoading, error } = useSWR<FibaOddsData>(
    homeTeam && awayTeam ? `fiba-odds-${homeTeam}-${awayTeam}` : null,
    () => fetcher(`/api/fiba/odds?home=${homeTeam}&away=${awayTeam}`),
    REFRESH_OPTS,
  );

  return {
    odds: data?.odds ?? null,
    source: data?.source ?? null,
    isLoading,
    error,
  };
}
