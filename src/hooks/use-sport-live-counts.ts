"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/**
 * Hook compteur live unifié par sport.
 * Appelle /api/v1/multisport-calendar?live=true toutes les 30s.
 * Retourne un Record<sportId, liveCount> utilisable par SportTabs.
 */

const POLL_INTERVAL = 30_000; // 30s

type LiveCounts = Record<string, number>;

export function useSportLiveCounts(): {
  counts: LiveCounts;
  total: number;
  loading: boolean;
} {
  const [counts, setCounts] = useState<LiveCounts>({});
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCounts = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        "/api/v1/multisport-calendar?live=true",
        { signal: controller.signal }
      );
      if (!res.ok) return;

      const data = (await res.json()) as {
        matches?: Array<{ sport: string; isLive: boolean }>;
      };

      if (controller.signal.aborted) return;

      const next: LiveCounts = {};
      for (const m of data.matches ?? []) {
        if (m.isLive) {
          next[m.sport] = (next[m.sport] ?? 0) + 1;
        }
      }
      setCounts(next);
    } catch {
      // silently ignore
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const timer = setInterval(fetchCounts, POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [fetchCounts]);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return { counts, total, loading };
}
