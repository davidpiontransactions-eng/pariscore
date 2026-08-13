"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type {
  CompetitionsPayload,
  MatchDetailPayload,
  PredictionsPayload,
  StandingsPayload,
} from "@/lib/rugby/types";

/**
 * Hooks SWR du domaine rugby — clés de cache strictement isolées :
 *   rugby:competitions
 *   rugby:predictions:{slug}
 *   rugby:standings:{slug}
 *   rugby:match:{slug}:{id}
 * Pas de re-fetch au focus (économie VPS) — rafraîchissement manuel ou
 * intervalle dédié uniquement.
 */

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const LIST_CONFIG: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  keepPreviousData: true,
  dedupingInterval: 30_000,
};

export function useRugbyCompetitions() {
  return useSWR<CompetitionsPayload>(
    "rugby:competitions",
    () => fetcher<CompetitionsPayload>("/api/rugby/competitions"),
    // 60 s : le premier chargement renvoie l'état courant (cache froid servi
    // immédiatement, sync lancée en arrière-plan) — l'intervalle converge
    // vers les données complètes une fois la resync terminée.
    { ...LIST_CONFIG, refreshInterval: 60_000 }
  );
}

export function useRugbyPredictions(slug: string | null) {
  const key = slug ? `rugby:predictions:${slug}` : null;
  return useSWR<PredictionsPayload>(
    key,
    () => fetcher<PredictionsPayload>(`/api/rugby/predictions?slug=${encodeURIComponent(slug ?? "")}`),
    // Rafraîchissement périodique : un onglet laissé ouvert doit voir les
    // cotes et probabilités évoluer (changements de ratings pendant la saison).
    { ...LIST_CONFIG, refreshInterval: 300_000 }
  );
}

export function useRugbyStandings(slug: string | null) {
  const key = slug ? `rugby:standings:${slug}` : null;
  return useSWR<StandingsPayload>(
    key,
    () => fetcher<StandingsPayload>(`/api/rugby/standings?slug=${encodeURIComponent(slug ?? "")}`),
    { ...LIST_CONFIG, refreshInterval: 120_000 }
  );
}

export function useRugbyMatchDetail(slug: string | null, id: string | null) {
  const key = slug && id ? `rugby:match:${slug}:${id}` : null;
  return useSWR<MatchDetailPayload>(
    key,
    () =>
      fetcher<MatchDetailPayload>(
        `/api/rugby/match?slug=${encodeURIComponent(slug ?? "")}&id=${encodeURIComponent(id ?? "")}`
      ),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10_000,
    }
  );
}
