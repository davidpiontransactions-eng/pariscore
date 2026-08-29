"use client";

import useSWR from "swr";
import type { H2HTeam } from "@/lib/types/basketball-h2h";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Hook SWR pour la liste des équipes H2H (sélecteur).
 * Appelle /api/v1/basketball/h2h/teams?league=nba|wnba.
 */
export function useH2HTeams(league: "nba" | "wnba" | null) {
  const url = league
    ? `/api/v1/basketball/h2h/teams?league=${encodeURIComponent(league)}`
    : null;

  const { data, error, isLoading } = useSWR<H2HTeam[]>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_600_000, // 1h — liste stable
  });

  return {
    teams: data ?? [],
    isLoading,
    error: error ? String(error) : null,
  };
}
