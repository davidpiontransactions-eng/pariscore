"use client";

import useSWR from "swr";

export type EloHistoryPoint = { date: string; elo: number };
export type PlayerEloHistory = {
  playerId: string;
  currentElo: number;
  history: EloHistoryPoint[];
};

type EloHistoryResponse = {
  matchId: string;
  a: PlayerEloHistory;
  b: PlayerEloHistory;
};

const fetcher = async (url: string): Promise<EloHistoryResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`elo-history HTTP ${res.status}`);
  return res.json();
};

/**
 * Fetches the 12-month Elo progression for both players of a match.
 * Cached 5 minutes client-side (Elo changes slowly).
 */
export function useEloHistory(matchId: string | null) {
  return useSWR<EloHistoryResponse>(
    matchId ? `/api/tennis/elo-history?matchId=${matchId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 min
      errorRetryCount: 1,
    }
  );
}
