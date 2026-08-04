"use client";

import { useMemo } from "react";
import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Forme brute renvoyée par /api/cs2/matches (BSD, normalisé côté service). */
type RawCs2Match = {
  id?: string | number;
  scheduled?: string | null;
  status?: string;
  tournament?: string | null;
  best_of?: number | null;
  current_map?: string | null;
  team1?: { name?: string | null; hltv_rank?: number | null };
  team2?: { name?: string | null; hltv_rank?: number | null };
};

/** Match CS2 normalisé pour l'UI (onglet "meilleurs matchs"). */
export type Cs2Match = {
  id: string;
  sport: "cs2";
  scheduledAt: string;
  status: string;
  tournament: string;
  team1: { name: string; rank: number | null };
  team2: { name: string; rank: number | null };
  bestOf: number | null;
  currentMap: string | null;
};

const REFRESH_OPTS = {
  refreshInterval: 60_000, // poll every 60s — cohérent avec usePrematchMatches
  revalidateOnFocus: false,
  errorRetryCount: 2,
};

const fetcher = async (url: string): Promise<RawCs2Match[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (json && typeof json === "object" && Array.isArray((json as { matches?: unknown }).matches)) {
    return (json as { matches: RawCs2Match[] }).matches;
  }
  throw new Error("Réponse invalide");
};

// ---------------------------------------------------------------------------
// Normalisation BSD → Cs2Match
// ---------------------------------------------------------------------------

// Les noms BSD sont normalisés en minuscules côté service — on rétablit une
// casse lisible pour l'affichage ("g2 ares" → "G2 Ares").
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeMatch(raw: RawCs2Match): Cs2Match | null {
  const scheduled = raw.scheduled ?? "";
  if (!scheduled) return null;
  const t1 = raw.team1 ?? {};
  const t2 = raw.team2 ?? {};
  return {
    id: String(raw.id ?? ""),
    sport: "cs2",
    scheduledAt: scheduled,
    status: raw.status ?? "prematch",
    tournament: raw.tournament ?? "CS2",
    team1: { name: toTitleCase(t1.name ?? "TBD"), rank: t1.hltv_rank ?? null },
    team2: { name: toTitleCase(t2.name ?? "TBD"), rank: t2.hltv_rank ?? null },
    bestOf: raw.best_of ?? null,
    currentMap: raw.current_map ?? null,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCs2Matches() {
  const { data, isLoading, error } = useSWR<RawCs2Match[]>(
    "/api/cs2/matches",
    fetcher,
    REFRESH_OPTS,
  );

  const matches = useMemo<Cs2Match[]>(() => {
    const list = (data ?? [])
      .map(normalizeMatch)
      .filter((m): m is Cs2Match => m !== null);
    // Matchs terminés → inutiles dans "meilleurs matchs du jour"
    return list
      .filter((m) => m.status !== "finished")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [data]);

  return { matches, isLoading, error };
}
