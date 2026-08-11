"use client";

import useSWR from "swr";

import type { PressReviewResult } from "@/lib/tennis-press-review-service";

/** Données brutes telles que renvoyées par /api/v1/tennis/press-review. */
export type { PressSource, PressPrediction, PressConsensus, PressReviewResult } from "@/lib/tennis-press-review-service";

type ApiResponse = {
  review: PressReviewResult | null;
  meta: { ttlSeconds: number };
};

type PressReviewHookResult = {
  review: PressReviewResult | null;
  isLoading: boolean;
};

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Hook SWR — revue de presse tennis (3+ prédictions de sources spécialisées).
 * Cache serveur 24h, le client déduplique pendant 10 min.
 * Retourne `review: null` si les données ne sont pas encore disponibles (pas une erreur).
 */
export function usePressReview(
  matchId: string | null,
  playerA: string | null,
  playerB: string | null,
  tournament?: string,
  surface?: string,
): PressReviewHookResult {
  const qs = matchId && playerA && playerB
    ? `matchId=${encodeURIComponent(matchId)}&playerA=${encodeURIComponent(playerA)}&playerB=${encodeURIComponent(playerB)}${tournament ? `&tournament=${encodeURIComponent(tournament)}` : ""}${surface ? `&surface=${encodeURIComponent(surface)}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR<ApiResponse>(
    qs ? `/api/v1/tennis/press-review?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000,
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  const review = error ? null : (data?.review ?? null);
  return { review, isLoading: isLoading && !review };
}
