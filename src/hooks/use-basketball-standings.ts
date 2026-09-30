"use client";

import useSWR from "swr";
import type { BasketballStandingsTeam } from "@/lib/basketball-standings";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

export type BasketballStandingsPayload = {
  league: string;
  season: number;
  teams: BasketballStandingsTeam[];
  generatedAt: string;
};

/** Hook SWR du classement basket (nba|wnba) — cache serveur 10 min. */
export function useBasketballStandings(league: "nba" | "wnba") {
  const { data, error, isLoading } = useSWR<BasketballStandingsPayload>(
    `/api/basketball/standings?league=${league}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );
  return { data, isLoading, error: error ? String(error) : null };
}
