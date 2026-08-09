"use client";

import useSWR from "swr";
import type { EditorialLang } from "@/lib/match-editorial-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Résumé éditorial tel que renvoyé par /api/v1/editorial. */
export type EditorialSummary = {
  text: string;
  source: string;
  url: string;
  translated: boolean;
  fetchedAt: string;
};

export type EditorialHookResult = {
  summary: EditorialSummary | null;
  isLoading: boolean;
};

type EditorialResponse =
  | {
      summary: {
        text: string;
        source: string;
        url: string;
        translated: boolean;
        fetchedAt: string;
      };
      meta: { lang: EditorialLang; translated: boolean; ttlSeconds: number };
    }
  | { summary: null };

/**
 * Hook SWR — analyse éditoriale (2-3 phrases) d'un match pour les cartes &
 * modales. Cache serveur 24h ; le client déduplique pendant 10 min. Pas
 * d'erreur remontée si aucun article trouvé (l'UI masque simplement l'encart).
 *
 * `lang` : "fr" (traduit EN→FR) ou "en" (texte source). Toute autre locale
 * est résolue côté serveur comme "fr".
 */
export function useEditorialSummary(
  sport: "tennis" | "football" | null,
  matchId: string | null,
  playerAName: string | null,
  playerBName: string | null,
  lang: EditorialLang = "en",
): EditorialHookResult {
  const qs =
    sport && matchId && playerAName && playerBName
      ? `sport=${encodeURIComponent(sport)}&matchId=${encodeURIComponent(matchId)}&playerA=${encodeURIComponent(playerAName)}&playerB=${encodeURIComponent(playerBName)}&lang=${lang}`
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