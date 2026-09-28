"use client";

import useSWR from "swr";
import type { MatchTimelineData } from "@/lib/football-timeline";

/**
 * Timeline momentum/pression d'un match — GET /api/football/matches/[id]/stats.
 *
 * La route est cache 60 s côté serveur (Map globalThis) : on rafraîchit au même
 * rythme pour ne jamais la contourner. Les couches (momentum, xG/minute, pression)
 * sont ABSENTES du flux list live (`FootballLiveState`) — c'est le seul moyen de
 * les obtenir, c'est pourquoi la carte live les charge à la demande.
 *
 * Best-effort : une erreur ne casse jamais la carte, les blocs dépendants sont
 * simplement omis (retrait visuel, pas de bandeau d'erreur sur une grille).
 */
async function fetchTimeline(url: string): Promise<MatchTimelineData> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as MatchTimelineData;
}

export function useFootballMatchStats(matchId: string | undefined, live: boolean) {
  const raw = matchId?.replace(/^bsd-/, "") ?? "";
  // Même garde que le popup détail : l'id est interpolé dans l'URL serveur.
  const id = /^\d+$/.test(raw) ? raw : null;

  const { data } = useSWR<MatchTimelineData>(
    id ? `/api/football/matches/${encodeURIComponent(id)}/stats` : null,
    fetchTimeline,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      keepPreviousData: true,
      refreshInterval: live ? 60_000 : 0,
      onError: () => {
        /* best-effort silencieux */
      },
    },
  );

  return data ?? null;
}
