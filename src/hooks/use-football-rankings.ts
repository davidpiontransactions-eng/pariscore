"use client";

import useSWR from "swr";

export type FdRankRow = { team: string; value: number; gp: number };
export type XgRankRow = { team: string; gp: number; xgFor: number; xgAgainst: number };

type MarketRows =
  | ({ gfPg: FdRankRow[] } & Record<string, FdRankRow[] | undefined>)
  | { xgFor?: XgRankRow[]; xgAgainst?: XgRankRow[] };

type RankingsResponse = {
  league: string;
  season: string;
  scope: string;
  availableSeasons: string[];
  higherBetter: Record<string, boolean>;
  markets: Record<string, FdRankRow[] | XgRankRow[] | undefined>;
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<RankingsResponse>;
  });

/**
 * Classements par championnat (tous marchés en un appel) :
 * buts moyens, O1.5/U3.5, BTTS, corners O6.5/O7.5, PPM + xG/xGA.
 */
export function useFootballLeagueRankings(
  league: string | null,
  season: string | null,
  scope: "overall" | "home" | "away",
) {
  const qs = new URLSearchParams();
  if (league) qs.set("league", league);
  if (season) qs.set("season", season);
  qs.set("scope", scope);

  const { data, error, isLoading } = useSWR<RankingsResponse>(
    league ? `/api/football/rankings?${qs.toString()}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 60_000 },
  );

  return {
    data,
    error,
    isLoading,
    isReady: data != null,
    availableSeasons: data?.availableSeasons ?? [],
    rowsFor: (market: string): FdRankRow[] | XgRankRow[] | undefined => data?.markets?.[market],
  };
}
