"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type PreviousRoundApiPlayer = {
  playerId: string;
  playerName: string;
  label: "tour-precedent" | "dernier-match";
  context: {
    round: string | null;
    tournament: string | null;
    surface: string | null;
    opponent: string | null;
    won: boolean | null;
    score: string | null;
  };
  video: { videoId: string; title: string; url: string } | null;
};

export type PreviousRoundApiResult = {
  players: PreviousRoundApiPlayer[];
  source: "bsd" | "fallback";
  meta: { ttlSeconds: number };
};

/**
 * Hook SWR — highlights du tour précédent pour les 2 joueurs d'un duel.
 * Cache serveur 48 h, déduplication client 10 min. Ne throw jamais : en
 * cas d'erreur on retombe sur null et le widget se masque (jamais d'erreur UI).
 */
export function usePreviousRoundHighlights(
  matchId: string | null,
  playerA: { id: string; name: string } | null,
  playerB: { id: string; name: string } | null,
  tournamentName?: string | null,
  surface?: string | null,
): { data: PreviousRoundApiResult | null; isLoading: boolean } {
  const qs =
    matchId && playerA && playerB
      ? `matchId=${encodeURIComponent(matchId)}` +
        `&playerAId=${encodeURIComponent(playerA.id)}` +
        `&playerAName=${encodeURIComponent(playerA.name)}` +
        `&playerBId=${encodeURIComponent(playerB.id)}` +
        `&playerBName=${encodeURIComponent(playerB.name)}` +
        (tournamentName ? `&tournament=${encodeURIComponent(tournamentName)}` : "") +
        (surface ? `&surface=${encodeURIComponent(surface)}` : "")
      : null;

  const { data, error } = useSWR<PreviousRoundApiResult>(
    qs ? `/api/v1/previous-match-highlights?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000,
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  return {
    data: error ? null : (data ?? null),
    isLoading: !!qs && !error && !data,
  };
}