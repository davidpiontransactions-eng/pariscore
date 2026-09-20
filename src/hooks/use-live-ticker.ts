"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook live ticker — récupère les 5 matchs live les plus pertinents.
 * Source : /api/v1/multisport-calendar?live=true
 * Polling : 15s (données live = fréquentes)
 * Rotation : auto toutes les 8s si > 5 matchs
 */

const POLL_MS = 15_000;
const ROTATE_MS = 8_000;
const MAX_VISIBLE = 3;

export type TickerMatch = {
  id: string;
  sport: string;
  home: string;
  away: string;
  score: string;
  minute: string | null;
  league: string;
  odds?: number[]; // historique cotes (optionnel, pour sparklines)
};

export function useLiveTicker() {
  const [matches, setMatches] = useState<TickerMatch[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLive = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/v1/multisport-calendar?live=true", {
        signal: ctrl.signal,
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        matches?: Array<{
          sport: string;
          home: string;
          away: string;
          score: string | null;
          time: string;
          league: string;
          isLive: boolean;
        }>;
      };

      if (ctrl.signal.aborted) return;

      const live = (data.matches ?? [])
        .filter((m) => m.isLive)
        .map((m, i) => ({
          id: `${m.sport}-${m.home}-${m.away}-${i}`,
          sport: m.sport,
          home: m.home,
          away: m.away,
          score: m.score ?? "–",
          minute: m.time || null,
          league: m.league,
        }));

      setMatches(live);

      // Corriger page si les données rétrécissent
      const newTotalPages = Math.max(1, Math.ceil(live.length / MAX_VISIBLE));
      setPage((p) => p % newTotalPages);
    } catch {
      // silent
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  // Polling
  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, POLL_MS);
    return () => {
      clearInterval(t);
      abortRef.current?.abort();
    };
  }, [fetchLive]);

  // Rotation auto
  const totalPages = Math.max(1, Math.ceil(matches.length / MAX_VISIBLE));

  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [totalPages]);

  const visible = matches.slice(page * MAX_VISIBLE, page * MAX_VISIBLE + MAX_VISIBLE);

  return {
    matches,
    visible,
    total: matches.length,
    page,
    totalPages,
    setPage,
    loading,
  };
}
