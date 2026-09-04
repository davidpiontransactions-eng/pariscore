"use client";

import useSWR from "swr";
import type { FibaGroup } from "@/app/api/fiba/standings/route";

const REFRESH_OPTS = {
  refreshInterval: 5 * 60_000, // 5min
  revalidateOnFocus: true,
  errorRetryCount: 2,
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export type FibaStandingsData = {
  groups: FibaGroup[];
  season: number;
  source: string;
};

export function useFibaStandings() {
  const { data, isLoading, error } = useSWR<FibaStandingsData>(
    "fiba-standings",
    () => fetcher("/api/fiba/standings"),
    REFRESH_OPTS,
  );

  return {
    groups: data?.groups ?? [],
    season: data?.season,
    isLoading,
    error,
  };
}
