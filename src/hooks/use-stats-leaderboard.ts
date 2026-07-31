"use client";

// Hook SWR pour le leaderboard stats joueurs (/api/tennis/stats-leaderboard).
// Même philosophie que use-player-stats : dégradation silencieuse (jamais
// d'erreur thrown), keepPreviousData pour éviter le clignotement quand
// l'utilisateur change de filtre.

import useSWR from "swr";
import type {
  LeaderboardParams,
  LeaderboardResult,
} from "@/lib/tennis-stats/leaderboard";

export type StatsLeaderboardQuery = Omit<LeaderboardParams, "minMatches"> & {
  minMatches?: number;
};

const fetcher = async (url: string): Promise<LeaderboardResult> => {
  const res = await fetch(url);
  if (!res.ok) {
    return {
      rows: [],
      meta: {
        board: "serve",
        tour: "atp",
        surface: "all",
        period: "52w",
        vsRank: "all",
        minMatches: 5,
        players: 0,
        generatedAt: new Date().toISOString(),
        dataUnavailable: true,
      },
    };
  }
  return res.json();
};

/**
 * @param query Filtres du leaderboard (board, tour, surface, period, vsRank).
 * La clé SWR embarque tous les filtres → changement de filtre = refetch,
 * avec conservation des données précédentes pendant le chargement.
 */
export function useStatsLeaderboard(query: StatsLeaderboardQuery) {
  const qs = new URLSearchParams({
    board: query.board,
    tour: query.tour,
    surface: query.surface,
    period: query.period,
    vsRank: query.vsRank,
    minMatches: String(query.minMatches ?? 5),
  });

  return useSWR<LeaderboardResult>(
    `/api/tennis/stats-leaderboard?${qs.toString()}`,
    fetcher,
    {
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      errorRetryCount: 1,
      keepPreviousData: true,
    }
  );
}
