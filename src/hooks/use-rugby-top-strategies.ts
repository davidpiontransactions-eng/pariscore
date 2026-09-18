"use client";

import useSWR from "swr";
import type { RugbyStrategyKey, RugbyStrategyMatch } from "@/lib/rugby-strategy-top";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

/**
 * SWR hook : récupère le top N matchs rugby pour une stratégie donnée.
 * Source : GET /api/rugby/top-strategies?strategy=X&limit=N
 */
export function useRugbyTopStrategies(
  strategy: RugbyStrategyKey,
  limit: number = 10,
): { matches: RugbyStrategyMatch[]; loading: boolean; error: unknown } {
  const { data, isLoading, error } = useSWR(
    `rugby-top-strategies-${strategy}-${limit}`,
    () => fetcher(`/api/rugby/top-strategies?strategy=${strategy}&limit=${limit}`),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    matches: (data?.matches as RugbyStrategyMatch[]) ?? [],
    loading: isLoading,
    error,
  };
}
