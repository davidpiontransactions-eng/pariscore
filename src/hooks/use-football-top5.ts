"use client";

import useSWR from "swr";
import type { StrategyTop5, StrategyTop5Key } from "@/lib/football-strategy-top5";
import type { KickoffWindow } from "@/lib/football-time";

type Top5Response = StrategyTop5 & { meta?: { source: string; computedAt: string } };

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<Top5Response>;
};

/** Top 5 matchs à venir par stratégie — forme L5 Domicile/Extérieur (cache 10 min). */
export function useFootballTop5(win?: KickoffWindow) {
  const qs = win ? `?win=${win}` : "";
  const { data, error, isLoading } = useSWR<Top5Response>(
    `/api/football/top5${qs}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5 * 60_000 },
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

/**
 * Top 10 (limit paramétrable) — global « Toutes les ligues » ou par championnat.
 * `win` est envoyé à l'API : le top-N est classé DANS la fenêtre, sinon le
 * filtre temporel client tombe à zéro.
 */
export function useFootballTopN(limit: number, league: string | null, win?: KickoffWindow) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (league) params.set("league", league);
  if (win) params.set("win", win);
  const url = `/api/football/top5?${params.toString()}`;

  const { data, error, isLoading } = useSWR<Top5Response>(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5 * 60_000,
  });

  return {
    data,
    error,
    isLoading,
    isReady: data != null,
    matchesFor: (key: StrategyTop5Key) => data?.strategies?.[key] ?? [],
    window: data?.window ?? 5,
  };
}
