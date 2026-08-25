"use client";

import useSWR from "swr";
import type { SportBacktestSummary, Top5Sport } from "@/lib/top5-backtest/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<SportBacktestSummary>;
};

/**
 * Backtest « Top 5 par stratégie » d'un sport — stats par stratégie + derniers
 * picks réglés (store local, settle quotidien). Null tant que le backfill
 * n'a pas tourné.
 */
export function useTop5Backtest(sport: Top5Sport) {
  const { data, isLoading } = useSWR<SportBacktestSummary>(
    `/api/${sport}/top5/backtest`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60_000 },
  );

  return {
    summary: data ?? null,
    isLoading,
  };
}
