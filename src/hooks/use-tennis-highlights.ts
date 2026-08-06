"use client";

import useSWR from "swr";
import type { TennisHighlight } from "@/lib/scraping/tennistv-highlights-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type TennisHighlightsResult = {
  highlightA: TennisHighlight | null;
  highlightB: TennisHighlight | null;
  isLoading: boolean;
};

type HighlightsResponse =
  | {
      highlights: { playerA: TennisHighlight | null; playerB: TennisHighlight | null };
      meta: { ttlSeconds: number };
    }
  | { highlights: null };

/**
 * Hook SWR — dernier highlight TennisTV (YouTube) de chaque joueur d'un duel.
 * Cache serveur 24 h ; le client déduplique pendant 10 min (comme les autres
 * hooks de scraping dédiés). Pas d'erreur remontée si aucune vidéo trouvée,
 * l'UI masque simplement le chip.
 */
export function useTennisHighlights(
  playerAName: string | null,
  playerBName: string | null,
): TennisHighlightsResult {
  const qs =
    playerAName && playerBName
      ? `playerA=${encodeURIComponent(playerAName)}&playerB=${encodeURIComponent(playerBName)}`
      : null;

  const { data, error, isLoading } = useSWR<HighlightsResponse>(
    qs ? `/api/v1/tennistv-highlights?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000, // 10 min côté client
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  const highlights = error ? null : (data?.highlights ?? null);
  const highlightA = highlights?.playerA ?? null;
  const highlightB = highlights?.playerB ?? null;
  return {
    highlightA,
    highlightB,
    isLoading: isLoading && !highlightA && !highlightB,
  };
}