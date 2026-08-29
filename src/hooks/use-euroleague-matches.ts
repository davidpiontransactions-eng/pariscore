/**
 * SWR hook pour les matchs EuroLeague/EuroCup.
 * Utilise /api/euroleague/matches (euroleague_api bridge).
 */

"use client";

import useSWR from "swr";
import type { EuroLeagueMatch } from "@/lib/euroleague-data";

type EuroLeagueResponse = {
  games: EuroLeagueMatch[];
  error?: string;
};

const fetcher = async (url: string): Promise<EuroLeagueResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch EuroLeague matches");
  return res.json();
};

export function useEuroLeagueMatches(
  league: "euroleague" | "eurocup" = "euroleague",
  season?: string,
) {
  const params = new URLSearchParams({ league });
  if (season) params.set("season", season);

  const { data, error, isLoading, mutate } = useSWR<EuroLeagueResponse>(
    `/api/euroleague/matches?${params.toString()}`,
    fetcher,
    {
      refreshInterval: league === "euroleague" ? 60_000 : 300_000, // EuroLeague live plus fréquent
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    },
  );

  return {
    matches: data?.games ?? [],
    apiError: data?.error ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
