"use client";

import useSWR from "swr";
import type { TournamentDraw } from "@/lib/types/tennis-draw";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<TournamentDraw>;
  });

/**
 * Hook SWR pour charger le tableau forecast d'un tournoi TennisAbstract.
 *
 * @param slug  - Slug du tournoi (ex: "monterrey", "australian-open")
 * @param year  - Année (défaut : année courante)
 * @returns     - { draw, isLoading, error }
 */
export function useTournamentDraw(slug: string | null, year?: number) {
  const y = year ?? new Date().getFullYear();
  const key = slug ? `tournament-draw-${slug}-${y}` : null;
  const url = slug
    ? `/api/tennis/tournament/${slug}/draw?year=${y}`
    : null;

  const { data, error, isLoading } = useSWR<TournamentDraw>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60_000, // 5 min
    errorRetryCount: 2,
    errorRetryInterval: 10_000,
  });

  return {
    draw: data,
    isLoading,
    error: error ?? null,
  };
}
