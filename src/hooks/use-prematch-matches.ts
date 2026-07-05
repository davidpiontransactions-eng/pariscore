"use client";

import useSWR from "swr";
import type { TennisMatch } from "@/lib/tennis-data";

type PrematchResponse = {
  matches: TennisMatch[];
  source: "cache" | "odds-api" | "mock";
  updatedAt: string;
};

const fetcher = async (url: string): Promise<PrematchResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch prematch: ${res.status}`);
  }
  return res.json();
};

export function usePrematchMatches() {
  return useSWR<PrematchResponse>("/api/tennis/prematch", fetcher, {
    refreshInterval: 60_000, // poll every 60s
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    errorRetryCount: 2,
  });
}
