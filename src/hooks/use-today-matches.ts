"use client";

// Matchs du jour par sport (mission k044) — agrège /api/v1/multisport-calendar.
// Défensif par conception : réponse absente, mal formée ou erreur réseau → [].
// (Le combobox affiche alors un état vide + bascule saisie libre, jamais un crash.)
import { useMemo } from "react";
import useSWR from "swr";

export type TodayMatch = {
  sport: string;
  league: string;
  /** "HH:MM" (Europe/Paris) — peut être vide. */
  time: string;
  home: string;
  away: string;
  isLive: boolean;
};

const txt = (v: unknown): string => (typeof v === "string" ? v : "");

async function fetchMatches(url: string): Promise<TodayMatch[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const arr = Array.isArray((data as { matches?: unknown[] })?.matches)
      ? ((data as { matches: unknown[] }).matches as Record<string, unknown>[])
      : [];
    return arr
      .map((m) => ({
        sport: txt(m.sport),
        league: txt(m.league),
        time: txt(m.time),
        home: txt(m.home),
        away: txt(m.away),
        isLive: m.isLive === true,
      }))
      .filter((m) => m.home !== "" || m.away !== "");
  } catch {
    return [];
  }
}

/**
 * Matchs du jour pour un sport. `sport = null` → pas d'appel (SWR key nulle).
 * Tri : heure croissante (sans heure = en fin), puis compétition.
 */
export function useTodayMatches(sport: string | null): {
  matches: TodayMatch[];
  isLoading: boolean;
} {
  const key = sport ? `/api/v1/multisport-calendar?sport=${encodeURIComponent(sport)}` : null;
  const { data, isLoading } = useSWR(key, fetchMatches, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
    shouldRetryOnError: false,
    keepPreviousData: true,
  });

  const matches = useMemo(() => {
    const list = data ?? [];
    return [...list].sort(
      (a, b) =>
        (a.time || "zz").localeCompare(b.time || "zz") || a.league.localeCompare(b.league)
    );
  }, [data]);

  return { matches, isLoading };
}
