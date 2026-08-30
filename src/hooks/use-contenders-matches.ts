"use client";

import useSWR from "swr";

interface ContenderMatch {
  rank: number;
  name: string;
  seed?: number;
  country?: string;
  probWin?: number;
  match?: {
    opponent: string;
    opponentSeed?: number;
    opponentCountry?: string;
    round: string;
    scheduledAt?: string;
    score?: string;
    status: "upcoming" | "live" | "completed";
    tournament: string;
  };
}

interface ContendersResponse {
  slug: string;
  year: number;
  contenders: ContenderMatch[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useContendersMatches(slug: string, year?: number) {
  const params = year ? `?year=${year}` : "";
  const { data, isLoading, error } = useSWR<ContendersResponse>(
    `/api/tennis/tournament/${slug}/contenders-matches${params}`,
    fetcher,
    { refreshInterval: 5 * 60_000, revalidateOnFocus: true },
  );

  return {
    contenders: data?.contenders ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
