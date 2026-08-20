"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type {
  LeagueFilter,
  MatchDetailPayload,
  SchedulePayload,
} from "@/lib/baseball/types";

/**
 * Hooks SWR du domaine baseball — clés de cache strictement isolées :
 *   baseball:schedule:{date}:{league}   (collisions MLB/KBO impossibles)
 *   baseball:match:{id}
 * Re-fetch au focus + reconnexion pour éviter les données stale.
 */

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const SCHEDULE_CONFIG: SWRConfiguration<SchedulePayload> = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
  refreshInterval: 30_000,
  dedupingInterval: 30_000,
};

export function useBaseballSchedule(date: string, league: LeagueFilter) {
  const key = `baseball:schedule:${date}:${league}`;
  return useSWR<SchedulePayload>(
    key,
    () =>
      fetcher<SchedulePayload>(
        `/api/baseball/schedule?date=${encodeURIComponent(date)}&league=${encodeURIComponent(league)}`,
      ),
    SCHEDULE_CONFIG,
  );
}

export function useBaseballMatchDetail(id: string | null) {
  const key = id ? `baseball:match:${id}` : null;
  return useSWR<MatchDetailPayload>(
    key,
    () => fetcher<MatchDetailPayload>(`/api/baseball/match/${encodeURIComponent(id ?? "")}`),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
    },
  );
}
