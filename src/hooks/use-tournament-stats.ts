"use client";

import useSWR from "swr";
import type { TournamentStatsResult } from "@/lib/tournament-stats-engine";
import { parseBsdId } from "@/lib/bsd-id";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/**
 * Hook SWR — moyennes par tournoi des deux joueuses d'un match BSD.
 *
 * Proxie `/api/tennis/tournament-stats?matchId=…` : le serveur agrège les
 * matchs terminés de l'édition en cours (fallback : moyenne de la saison sur
 * surface dure signalée par `source: "season-hard"`). Cache serveur 5 min,
 * déduplication client 5 min. Ne throw jamais : en cas d'erreur on retombe
 * sur `null` et l'onglet Stats affiche l'état "non disponibles".
 */
export function useTournamentStats(matchId: string | null): {
  data: TournamentStatsResult | null;
  isLoading: boolean;
} {
  const bsdId = matchId ? parseBsdId(matchId) : null;
  const qs = bsdId !== null ? `/api/tennis/tournament-stats?matchId=${bsdId}` : null;

  const { data, error } = useSWR<TournamentStatsResult>(
    qs,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000,
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  return {
    data: error ? null : (data ?? null),
    isLoading: !!qs && !error && !data,
  };
}