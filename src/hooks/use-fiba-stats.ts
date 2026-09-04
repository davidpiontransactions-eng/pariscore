"use client";

import useSWR from "swr";
import type { FibaTeamStats } from "@/app/api/fiba/stats/route";

const REFRESH_OPTS = {
  refreshInterval: 30 * 60_000, // 30min (stats changent peu)
  revalidateOnFocus: true,
  errorRetryCount: 2,
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export type FibaStatsData = {
  teams: FibaTeamStats[];
  source: string;
  lastUpdated: string;
};

export function useFibaStats() {
  const { data, isLoading, error } = useSWR<FibaStatsData>(
    "fiba-stats",
    () => fetcher("/api/fiba/stats"),
    REFRESH_OPTS,
  );

  // Index par abbr pour lookup rapide
  const statsByAbbr = new Map<string, FibaTeamStats>();
  for (const team of data?.teams ?? []) {
    statsByAbbr.set(team.abbr, team);
  }

  return {
    teams: data?.teams ?? [],
    statsByAbbr,
    isLoading,
    error,
  };
}

/** Hook pour une équipe spécifique */
export function useFibaTeamStats(teamAbbr: string | null) {
  const { data, isLoading, error } = useSWR<{ team: FibaTeamStats; source: string }>(
    teamAbbr ? `fiba-stats-${teamAbbr}` : null,
    () => fetcher(`/api/fiba/stats?team=${teamAbbr}`),
    REFRESH_OPTS,
  );

  return {
    stats: data?.team ?? null,
    isLoading,
    error,
  };
}
