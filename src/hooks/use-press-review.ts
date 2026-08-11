"use client";

import useSWR from "swr";

import type { PressReviewResult } from "@/lib/tennis-press-review-service";
import type { FootballPressReviewResult } from "@/lib/football-press-review-service";

export type { PressSource, PressPrediction, PressConsensus, PressReviewResult } from "@/lib/tennis-press-review-service";
export type { FootballPressSource, FootballPressPrediction, FootballPressConsensus, FootballPressReviewResult } from "@/lib/football-press-review-service";

type TennisApiResponse = {
  review: PressReviewResult | null;
  meta: { ttlSeconds: number };
};

type FootballApiResponse = {
  review: FootballPressReviewResult | null;
  meta: { ttlSeconds: number };
};

type PressReviewHookResult<T> = {
  review: T | null;
  isLoading: boolean;
};

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Hook SWR — revue de presse tennis (3+ predictions de sources specialisees).
 * Cache serveur 24h, le client deduplique pendant 10 min.
 */
export function usePressReview(
  matchId: string | null,
  playerA: string | null,
  playerB: string | null,
  tournament?: string,
  surface?: string,
): PressReviewHookResult<PressReviewResult> {
  const qs = matchId && playerA && playerB
    ? `matchId=${encodeURIComponent(matchId)}&playerA=${encodeURIComponent(playerA)}&playerB=${encodeURIComponent(playerB)}${tournament ? `&tournament=${encodeURIComponent(tournament)}` : ""}${surface ? `&surface=${encodeURIComponent(surface)}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR<TennisApiResponse>(
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

/**
 * Hook SWR — revue de presse football (3+ predictions de sources specialisees).
 * Cache serveur 24h, le client deduplique pendant 10 min.
 */
export function useFootballPressReview(
  matchId: string | null,
  homeTeam: string | null,
  awayTeam: string | null,
  leagueName?: string,
): PressReviewHookResult<FootballPressReviewResult> {
  const qs = matchId && homeTeam && awayTeam
    ? `matchId=${encodeURIComponent(matchId)}&home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}${leagueName ? `&league=${encodeURIComponent(leagueName)}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR<FootballApiResponse>(
    qs ? `/api/v1/football/press-review?${qs}` : null,
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

