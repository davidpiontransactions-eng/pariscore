"use client";

import useSWR from "swr";
import type { HltvStatsResponse } from "@/lib/cs2/hltv-stats-types";

/**
 * useHltvStats — SWR hook pour les stats HLTV maps & équipes.
 *
 * @param options.team  — filtre par nom d'équipe (recherche partielle)
 * @param options.map   — filtre par carte (Mirage, Inferno, etc.)
 * @param options.ranked — top-15 uniquement
 */
export function useHltvStats(options?: {
  team?: string;
  map?: string;
  ranked?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.team) params.set("team", options.team);
  if (options?.map) params.set("map", options.map);
  if (options?.ranked) params.set("ranked", "1");

  const qs = params.toString();
  const url = `/api/cs2/hltv-stats${qs ? `?${qs}` : ""}`;

  const { data, isLoading, error } = useSWR<HltvStatsResponse>(
    url,
    async (u: string) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60_000, // 5 min
      errorRetryCount: 2,
    }
  );

  return {
    teamStats: data?.teamStats ?? null,
    mapPool: data?.mapPool ?? null,
    isLoading,
    error: error as Error | null,
    age: data?.age ?? null,
  };
}
