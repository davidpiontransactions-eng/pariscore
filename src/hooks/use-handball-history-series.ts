"use client";

import useSWR from "swr";

export type TeamSeries = { gf: number[]; ga: number[]; atHome: boolean[] };

export type HistorySeriesPayload = {
  series: Record<string, TeamSeries | null>;
  meta: { n: number; minDate: string | null; maxDate: string | null; lastRun: string | null } | null;
  updatedAt: string;
};

const fetchJson = (url: string): Promise<HistorySeriesPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<HistorySeriesPayload>;
  });

/**
 * Séries gf/ga/atHome des derniers matchs, lues dans `handball_match_history`.
 *
 * Remplace la lecture par le form-store du snapshot courant, qui est vide dès que
 * l'ingestion décroche : c'était la cause du tableau TOP 10 vide alors que la
 * base contenait 8 000+ matchs sur 2 saisons.
 *
 * `teams` est trié/dédoublé avant la requête pour que la clé SWR soit stable
 * quel que soit l'ordre d'appel (sinon deux rendus identiques rechargent).
 * Renvoie `{}` si aucune équipe : pas de requête inutile.
 */
export function useHandballHistorySeries(teams: string[], limit = 10) {
  const key =
    teams.length > 0
      ? `/api/handball/history-series?teams=${encodeURIComponent(
          [...new Set(teams)].join("|"),
        )}&limit=${limit}`
      : null;
  const { data, error, isLoading } = useSWR<HistorySeriesPayload>(key, fetchJson, {
    dedupingInterval: 10 * 60_000,
    revalidateOnFocus: false,
  });
  return {
    series: data?.series ?? {},
    meta: data?.meta ?? null,
    updatedAt: data?.updatedAt ?? null,
    error,
    isLoading,
  };
}
