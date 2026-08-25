"use client";

import useSWR from "swr";
import type {
  TennisTop5Entry,
  TennisTop5Key,
  Top5Period,
  Top5Surface,
} from "@/lib/tennis-top5";

type Top5Response = {
  entries: TennisTop5Entry[];
  meta?: {
    matchesConsidered: number;
    playersInLeaderboard: number;
    dataUnavailable: boolean;
    computedAt: string;
  };
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<Top5Response>;
};

/**
 * Top 5 matchs tennis par métrique — un appel par combinaison
 * (métrique × surface × période), cache serveur 60 s.
 */
export function useTennisTop5(metric: TennisTop5Key, surface: Top5Surface, period: Top5Period) {
  const { data, error, isLoading } = useSWR<Top5Response>(
    `/api/tennis/top5?metric=${metric}&surface=${surface}&period=${period}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    entries: data?.entries ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error,
    isReady: data != null,
  };
}
