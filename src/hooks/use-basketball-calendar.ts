/**
 * use-basketball-calendar.ts — SWR /api/basketball/calendar?date=YYYY-MM-DD.
 * Retourne des FotmobCalMatch[] déjà fusionnés côté serveur (NBA/WNBA/Euro/FIBA).
 */

"use client";

import useSWR from "swr";
import type { FotmobCalMatch } from "@/components/football/fotmob-calendar-table";

export type BasketballCalendarData = {
  date: string;
  matches: FotmobCalMatch[];
  sources?: Record<string, number>;
  generatedAt?: string;
};

const fetcher = async (url: string): Promise<BasketballCalendarData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useBasketballCalendar(dateKey: string) {
  const { data, isLoading, error, mutate } = useSWR<BasketballCalendarData>(
    `/api/basketball/calendar?date=${encodeURIComponent(dateKey)}`,
    fetcher,
    {
      refreshInterval: 120_000, // matchs live du jour
      revalidateOnFocus: true,
      dedupingInterval: 60_000,
      keepPreviousData: true, // navigation jour ± : pas de flash vide
    },
  );

  return {
    matches: data?.matches ?? [],
    date: data?.date ?? dateKey,
    sources: data?.sources,
    isLoading,
    isError: !!error,
    mutate,
  };
}
