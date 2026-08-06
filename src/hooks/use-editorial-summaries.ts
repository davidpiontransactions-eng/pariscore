"use client";

import useSWR from "swr";
import type { EditorialSummary } from "@/lib/scraping/editorial-scraper-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type EditorialHookResult = {
  summary: EditorialSummary | null;
  isLoading: boolean;
};

type EditorialResponse =
  | { summary: EditorialSummary; meta: { ttlSeconds: number } }
  | { summary: null };

/**
 * Hook SWR — résumé éditorial (2-3 phrases) d'un match pour l'encart
 * « Presse / Preview » de la carte Top 10. Cache serveur 24h ; le client
 * déduplique pendant 10 min. Pas d'erreur remontée si aucun article trouvé
 * (l'UI masque simplement l'encart).
 */
export function useEditorialSummary(
  sport: "tennis" | "football" | null,
  matchId: string | null,
  playerAName: string | null,
  playerBName: string | null,
): EditorialHookResult {
  const qs =
    sport && matchId && playerAName && playerBName
      ? `sport=${encodeURIComponent(sport)}&matchId=${encodeURIComponent(matchId)}&playerA=${encodeURIComponent(playerAName)}&playerB=${encodeURIComponent(playerBName)}`
      : null;

  const { data, error, isLoading } = useSWR<EditorialResponse>(
    qs ? `/api/v1/editorial?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000, // 10 min côté client
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  const summary = error ? null : (data?.summary ?? null);
  return { summary, isLoading: isLoading && !summary };
}
