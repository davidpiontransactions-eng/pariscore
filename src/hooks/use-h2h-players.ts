"use client";

import useSWR from "swr";
import type { PlayersResponse } from "@/lib/types/basketball-h2h";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

/**
 * Hook SWR pour les joueurs H2H d'une équipe.
 * Appelle /api/v1/basketball/h2h/players?league=nba|wnba&team={id}.
 */
export function useH2HPlayers(
  league: "nba" | "wnba" | null,
  teamId: string | null,
) {
  const shouldFetch = league && teamId;
  const url = shouldFetch
    ? `/api/v1/basketball/h2h/players?league=${encodeURIComponent(league)}&team=${encodeURIComponent(teamId)}`
    : null;

  const { data, error, isLoading } = useSWR<PlayersResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_600_000,
  });

  return {
    players: data?.players ?? [],
    standings: data?.standings ?? [],
    team: data?.team ?? null,
    isLoading,
    error: error ? String(error) : null,
  };
}
