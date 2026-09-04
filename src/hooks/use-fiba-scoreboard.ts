"use client";

import useSWR from "swr";
import type { FibaMatch } from "@/app/api/fiba/scoreboard/route";

const REFRESH_OPTS = {
  refreshInterval: 30_000, // 30s pour données live
  revalidateOnFocus: true,
  errorRetryCount: 2,
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export type FibaScoreboardData = {
  matches: FibaMatch[];
  season: number;
  calendar: string[];
  source: string;
};

export function useFibaScoreboard(dates?: string) {
  const url = dates
    ? `/api/fiba/scoreboard?dates=${encodeURIComponent(dates)}`
    : "/api/fiba/scoreboard";

  const { data, isLoading, error } = useSWR<FibaScoreboardData>(
    ["fiba-scoreboard", dates ?? "today"],
    () => fetcher(url),
    REFRESH_OPTS,
  );

  const matches = data?.matches ?? [];
  const liveMatches = matches.filter((m) => m.status === "in");
  const preMatches = matches.filter((m) => m.status === "pre");
  const postMatches = matches.filter((m) => m.status === "post");

  return {
    matches,
    liveMatches,
    preMatches,
    postMatches,
    season: data?.season,
    isLoading,
    error,
  };
}
