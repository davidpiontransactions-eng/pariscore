"use client";

import useSWR from "swr";
import type { RugbyStrategyKey, RugbyStrategyMatch } from "@/lib/rugby-strategy-top";
import type { TimeFilterKey } from "@/lib/match-view";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

/**
 * SWR hook : récupère le top N matchs rugby pour une stratégie donnée.
 * Source : GET /api/rugby/top-strategies?strategy=X&limit=N
 *
 * Quand un filtre horaire est actif, on fetch 50 matchs (au lieu de N)
 * pour avoir assez de candidats dans chaque créneau temporel.
 */
export function useRugbyTopStrategies(
  strategy: RugbyStrategyKey,
  limit: number = 10,
  timeFilter?: TimeFilterKey,
): { matches: RugbyStrategyMatch[]; loading: boolean; error: unknown } {
  // Si un filtre horaire est actif, on fetch plus de matchs
  const hasTimeFilter = timeFilter != null && timeFilter !== "all";
  const fetchLimit = hasTimeFilter ? 50 : limit;

  const { data, isLoading, error } = useSWR(
    `rugby-top-strategies-${strategy}-${fetchLimit}`,
    () => fetcher(`/api/rugby/top-strategies?strategy=${strategy}&limit=${fetchLimit}`),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    matches: (data?.matches as RugbyStrategyMatch[]) ?? [],
    loading: isLoading,
    error,
  };
}
