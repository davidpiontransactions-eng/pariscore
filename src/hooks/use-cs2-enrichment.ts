"use client";

import useSWR from "swr";
import type {
  Cs2Enrichment,
  Cs2MapLikelihood,
} from "@/lib/cs2/types";

type EnrichPayload = {
  enrichment: Cs2Enrichment;
  mapLikelihood: Cs2MapLikelihood;
  source?: string;
};

type VetoPayload = {
  veto: unknown | null;
  note?: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

/**
 * Hook d'enrichissement d'un duel CS2 (on-demand, à l'ouverture de la fiche match).
 * SWR cache la réponse 5 min et ne refetch pas en fond tant que la clé est fraîche.
 */
export function useCs2Enrichment(
  team1: string | null | undefined,
  team2: string | null | undefined,
  map?: string | null,
  matchId?: string | null,
) {
  const enabled = Boolean(team1 && team2);

  const enrichUrl = enabled
    ? `/api/cs2/enrich?team1=${encodeURIComponent(team1!)}&team2=${encodeURIComponent(team2!)}${map ? `&map=${encodeURIComponent(map)}` : ""}`
    : null;

  const vetoUrl = enabled && matchId ? `/api/cs2/veto/${encodeURIComponent(matchId)}` : null;

  const { data: enrich, isLoading: enrichLoading, error: enrichError } = useSWR<EnrichPayload>(
    enrichUrl,
    fetcher,
    { revalidateOnFocus: false, errorRetryCount: 2, dedupingInterval: 5 * 60_000 },
  );

  const { data: vetoData, isLoading: vetoLoading } = useSWR<VetoPayload>(
    vetoUrl,
    fetcher,
    { revalidateOnFocus: false, errorRetryCount: 1 },
  );

  return {
    enrichment: enrich?.enrichment ?? null,
    mapLikelihood: enrich?.mapLikelihood ?? null,
    veto: vetoData?.veto ?? null,
    isLoading: enrichLoading || vetoLoading,
    error: enrichError ? (enrichError as Error).message : null,
  };
}
