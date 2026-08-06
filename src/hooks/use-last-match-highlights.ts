"use client";

import useSWR from "swr";
import type { TennisHighlight } from "@/lib/scraping/tennistv-highlights-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type LastMatchHighlightsData = {
  h2h: TennisHighlight | null;
  playerA: TennisHighlight | null;
  playerB: TennisHighlight | null;
  tournament: TennisHighlight | null;
  source: "h2h" | "player" | "tournament" | "tennistv" | "empty";
};

type ApiResponse = {
  highlights: LastMatchHighlightsData;
  source: LastMatchHighlightsData["source"];
  featured: TennisHighlight | null;
  meta: { ttlSeconds: number };
};

/**
 * Hook SWR — highlights du dernier match d'un duel (recherche YouTube
 * ciblée). Cache serveur 48 h, déduplication client 10 min. Ne throw
 * jamais : en cas d'erreur on retombe sur des valeurs null et le widget
 * se masque.
 */
export function useLastMatchHighlights(
  playerAName: string | null,
  playerBName: string | null,
  tournamentName?: string | null,
): {
  data: LastMatchHighlightsData | null;
  featured: TennisHighlight | null;
  isLoading: boolean;
} {
  const qs =
    playerAName && playerBName
      ? `playerA=${encodeURIComponent(playerAName)}&playerB=${encodeURIComponent(playerBName)}` +
        (tournamentName ? `&tournament=${encodeURIComponent(tournamentName)}` : "")
      : null;

  const { data, error } = useSWR<ApiResponse>(
    qs ? `/api/v1/last-match-highlights?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000,
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  const highlights = error ? null : (data?.highlights ?? null);
  return {
    data: highlights,
    featured: data?.featured ?? null,
    isLoading: !!qs && !highlights,
  };
}