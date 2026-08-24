"use client";

import useSWR from "swr";
import type { PlayerRow } from "@/app/api/football/players/route";

type PlayersResponse = {
  league: string;
  seasonYear: number;
  scorers: PlayerRow[];
  assisters: PlayerRow[];
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<PlayersResponse>;
};

/**
 * Meilleurs buteurs & passeurs du championnat (Understat, cache 6 h).
 * season = "2025/26" → année de départ Understat (2025).
 */
export function useFootballPlayers(league: string | null, season: string | null) {
  const year = season ? parseInt(season.slice(0, 4), 10) : NaN;
  const enabled = league != null && Number.isFinite(year);

  const { data, error, isLoading } = useSWR<PlayersResponse>(
    enabled ? `/api/football/players?league=${league}&season=${season}&top=10` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 60_000 },
  );

  return {
    data,
    error,
    isLoading,
    isReady: data != null,
  };
}
