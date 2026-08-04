"use client";

import { useMemo } from "react";
import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Forme brute renvoyée par /api/nba/matches et /api/wnba/matches (ESPN). */
type RawESPNMatch = {
  id?: string | number;
  date?: string;
  status?: string;
  home?: {
    abbr?: string;
    name?: string;
    score?: number | null;
    record?: string | null;
  };
  away?: {
    abbr?: string;
    name?: string;
    score?: number | null;
    record?: string | null;
  };
  predictions?: {
    win_prob?: { edge_elo?: number | null };
    blended?: { p_home?: number | null; p_away?: number | null };
  };
};

/** Match basketball normalisé pour l'UI (onglet "meilleurs matchs"). */
export type BasketballMatch = {
  id: string;
  sport: "basketball";
  league: "NBA" | "WNBA";
  scheduledAt: string;
  status: string;
  home: { abbr: string; name: string; score: number | null; record: string | null };
  away: { abbr: string; name: string; score: number | null; record: string | null };
  /** Proba victoire domicile (0-100) — modèle blend ; null si indisponible. */
  pHome: number | null;
  pAway: number | null;
  /** Écart de rating (points Elo) — null si indisponible. */
  edgeElo: number | null;
};

const REFRESH_OPTS = {
  refreshInterval: 60_000, // poll every 60s — cohérent avec usePrematchMatches
  revalidateOnFocus: false,
  errorRetryCount: 2,
};

const fetcher = async (url: string): Promise<RawESPNMatch[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (json && typeof json === "object" && Array.isArray((json as { matches?: unknown }).matches)) {
    return (json as { matches: RawESPNMatch[] }).matches;
  }
  throw new Error("Réponse invalide");
};

// ---------------------------------------------------------------------------
// Normalisation ESPN → BasketballMatch
// ---------------------------------------------------------------------------

function normalizeMatch(raw: RawESPNMatch, league: "NBA" | "WNBA"): BasketballMatch {
  const home = raw.home ?? {};
  const away = raw.away ?? {};
  const pred = raw.predictions ?? {};
  const blend = pred.blended ?? null;
  const pHome = blend?.p_home ?? null;
  return {
    id: String(raw.id ?? ""),
    sport: "basketball",
    league,
    scheduledAt: raw.date ?? "",
    status: raw.status ?? "pre",
    home: {
      abbr: home.abbr ?? "",
      name: home.name ?? "?",
      score: home.score ?? null,
      record: home.record ?? null,
    },
    away: {
      abbr: away.abbr ?? "",
      name: away.name ?? "?",
      score: away.score ?? null,
      record: away.record ?? null,
    },
    pHome,
    pAway: blend?.p_away ?? (pHome != null ? +(100 - pHome).toFixed(1) : null),
    edgeElo: pred.win_prob?.edge_elo ?? null,
  };
}

// ---------------------------------------------------------------------------
// Hook — fusionne NBA + WNBA
// ---------------------------------------------------------------------------

export function useBasketballMatches() {
  const nba = useSWR<RawESPNMatch[]>("/api/nba/matches", fetcher, REFRESH_OPTS);
  const wnba = useSWR<RawESPNMatch[]>("/api/wnba/matches", fetcher, REFRESH_OPTS);

  const matches = useMemo<BasketballMatch[]>(() => {
    const list: BasketballMatch[] = [
      ...(nba.data ?? []).map((m) => normalizeMatch(m, "NBA")),
      ...(wnba.data ?? []).map((m) => normalizeMatch(m, "WNBA")),
    ];
    // Ne garde que les matchs à venir ou en cours — "meilleurs matchs du jour"
    return list
      .filter((m) => m.status !== "post" && m.status !== "finished")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [nba.data, wnba.data]);

  return {
    matches,
    isLoading: nba.isLoading || wnba.isLoading,
    error: nba.error ?? wnba.error,
  };
}
