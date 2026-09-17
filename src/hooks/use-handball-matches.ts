"use client";

import useSWR from "swr";
import type { HandballMatch } from "@/lib/handball-data";

const fetcher = (url: string): Promise<{ matches: HandballMatch[] }> =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function useHandballMatches() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    "/api/handball/matches",
    fetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );
  return {
    matches: (data?.matches ?? []) as HandballMatch[],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
