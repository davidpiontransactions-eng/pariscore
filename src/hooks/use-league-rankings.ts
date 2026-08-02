"use client";

import useSWR from "swr";
import type { MetricRankings } from "@/lib/football-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LeagueRankingsFull = {
  home: MetricRankings;
  away: MetricRankings;
};

/**
 * Hook SWR pour charger les classements Home/Away d'une ligue
 * depuis les fichiers JSON statiques servis par le CDN Vercel.
 *
 * Les fichiers sont générés quotidiennement par le workflow
 * GitHub Actions refresh-rankings.yml et stockés dans
 * /public/data/rankings/{leagueId}.json.
 *
 * @param leagueId - ID ligue PariScore (ex: "epl", "ligue1")
 * @param side     - "home" ou "away"
 */
export function useLeagueRankings(
  leagueId: string | null,
  side: "home" | "away" = "home"
) {
  const { data, error, isLoading, mutate } = useSWR<LeagueRankingsFull>(
    leagueId ? `/data/rankings/${leagueId}.json` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60 * 60 * 1000, // 1h (JSON regénéré toutes les 24h)
      errorRetryCount: 2,
      errorRetryInterval: 10_000,
    }
  );

  return {
    rankings: (data?.[side] ?? {}) as MetricRankings,
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  };
}
