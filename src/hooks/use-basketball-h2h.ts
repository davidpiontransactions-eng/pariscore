"use client";

import useSWR from "swr";
import type { H2HResponse } from "@/lib/types/basketball-h2h";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Hook SWR pour les données H2H basketball.
 * Appelle /api/v1/basketball/h2h uniquement quand les 3 params sont fournis.
 */
export function useBasketballH2H(
  league: "nba" | "wnba" | null,
  teamAId: string | null,
  teamBId: string | null,
) {
  const shouldFetch = league && teamAId && teamBId;
  const url = shouldFetch
    ? `/api/v1/basketball/h2h?league=${encodeURIComponent(league)}&teamA=${encodeURIComponent(teamAId)}&teamB=${encodeURIComponent(teamBId)}`
    : null;

  const { data, error, isLoading } = useSWR<H2HResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    h2h: data ?? null,
    isLoading,
    error: error ? String(error) : null,
  };
}
