"use client";

import useSWR from "swr";
import type { StrategyTop5, StrategyTop5Key } from "@/lib/football-strategy-top5";

type Top5Response = StrategyTop5 & { meta?: { source: string; computedAt: string } };

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<Top5Response>;
};

/** Top 5 matchs à venir par stratégie — forme L5 Domicile/Extérieur (cache 30 min). */
export function useFootballTop5() {
  const { data, error, isLoading } = useSWR<Top5Response>(
    "/api/football/top5",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 20 * 60_000 },
  );

  return {
    data,
    error,
    isLoading,
    isReady: data != null,
    matchesFor: (key: StrategyTop5Key) => data?.strategies?.[key] ?? [],
    window: data?.window ?? 5,
  };
}
