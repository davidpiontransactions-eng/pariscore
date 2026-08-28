"use client";

// R9 (latence live) : les stats arrivent désormais par le MÊME flux SSE que le
// score — `subscribeLiveStream` (EventSource unique partagé, live-stream-client.ts).
// Avant : socket.io dédié vers Bun :3001 (mini-services/tennis-live) qui écoutait
// `live_patch`… un événement que le mini-service n'émet jamais (il émet
// `initial_state`/`match_update`, sans stats) → les stats n'arrivaient JAMAIS et
// le hook retombait sur le fallback vide après 3 échecs (~5-10s de latence).
//
// Le broker (live-broker.ts) propage maintenant `live_stats` depuis BSD
// (bsd-fetcher.ts ne les jette plus), avec hash incluant les stats → un point
// qui change les stats repousse le snapshot < 1s sans modifier le score.

import { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import {
  subscribeLiveStream,
  type LiveStreamMatch,
} from "@/lib/live-stream-client";

export const TennisSetStatsSchema = z.object({
  p1_aces: z.number().nullable(),
  p2_aces: z.number().nullable(),
  p1_df: z.number().nullable(),
  p2_df: z.number().nullable(),
});

export type TennisSetStats = z.infer<typeof TennisSetStatsSchema>;

export const ServiceStatsSchema = z.object({
  p1_aces: z.number().nullable(),
  p2_aces: z.number().nullable(),
  p1_df: z.number().nullable(),
  p2_df: z.number().nullable(),
  p1_first_pct: z.number().nullable(),
  p2_first_pct: z.number().nullable(),
  p1_first_won: z.number().nullable(),
  p2_first_won: z.number().nullable(),
  p1_second_won: z.number().nullable(),
  p2_second_won: z.number().nullable(),
  p1_bp_saved: z.number().nullable(),
  p2_bp_saved: z.number().nullable(),
  p1_ret_won: z.number().nullable(),
  p2_ret_won: z.number().nullable(),
  p1_total_pts: z.number().nullable(),
  p2_total_pts: z.number().nullable(),
});

export type ServiceStats = z.infer<typeof ServiceStatsSchema>;

export const TennisLiveStatsSchema = ServiceStatsSchema.extend({
  _mock: z.boolean(),
  perSet: z.array(TennisSetStatsSchema),
});

export type TennisLiveStats = z.infer<typeof TennisLiveStatsSchema>;

// État vide honnête — tous les champs null → l'UI affiche « — » au lieu
// de chiffres inventés. Le badge « Données de démonstration » n'apparaît
// plus (pas de données fausses présentées comme réelles).
const EMPTY_STATS: TennisLiveStats = {
  p1_aces: null,
  p2_aces: null,
  p1_df: null,
  p2_df: null,
  p1_first_pct: null,
  p2_first_pct: null,
  p1_first_won: null,
  p2_first_won: null,
  p1_second_won: null,
  p2_second_won: null,
  p1_bp_saved: null,
  p2_bp_saved: null,
  p1_ret_won: null,
  p2_ret_won: null,
  p1_total_pts: null,
  p2_total_pts: null,
  _mock: false,
  perSet: [],
};

function tnSafeStatVal(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  const cleaned = String(v).replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function tnDataSentinel(m: Record<string, unknown>): boolean {
  const src =
    (m?._bsd_stats as Record<string, unknown>) ||
    (m?.live_stats as Record<string, unknown>) ||
    {};
  const checks = ["p1_aces", "p2_aces", "p1_first_pct", "p2_first_pct"];
  return checks.some(
    (k) => src[k] != null && tnSafeStatVal(src[k]) !== null,
  );
}

function tnNormalizeTennisStats(
  m: Record<string, unknown>,
): Omit<TennisLiveStats, "_mock" | "perSet"> & {
  _mock: boolean;
  perSet: TennisSetStats[];
} {
  const bsd = (m?._bsd_stats as Record<string, unknown>) || {};
  const ls = (m?.live_stats as Record<string, unknown>) || {};
  const sets = Array.isArray(m?.sets)
    ? (m.sets as Record<string, unknown>[])
    : [];
  const bsdSets = Array.isArray((bsd as Record<string, unknown>)?.sets)
    ? ((bsd as Record<string, unknown>).sets as Record<string, unknown>[])
    : [];

  const merge = (k: string): number | null => {
    for (const src of [bsd, ls]) {
      const v = src[k];
      if (v != null) {
        const n = tnSafeStatVal(v);
        if (n !== null) return n;
      }
    }
    return null;
  };

  const perSet: TennisSetStats[] = sets.map((s, i) => ({
    p1_aces: tnSafeStatVal(s.p1_aces ?? bsdSets[i]?.p1_aces ?? null),
    p2_aces: tnSafeStatVal(s.p2_aces ?? bsdSets[i]?.p2_aces ?? null),
    p1_df: tnSafeStatVal(s.p1_df ?? bsdSets[i]?.p1_df ?? null),
    p2_df: tnSafeStatVal(s.p2_df ?? bsdSets[i]?.p2_df ?? null),
  }));

  return {
    p1_aces: merge("p1_aces"),
    p2_aces: merge("p2_aces"),
    p1_df: merge("p1_df"),
    p2_df: merge("p2_df"),
    p1_first_pct: merge("p1_first_pct"),
    p2_first_pct: merge("p2_first_pct"),
    p1_first_won: merge("p1_first_won"),
    p2_first_won: merge("p2_first_won"),
    p1_second_won: merge("p1_second_won"),
    p2_second_won: merge("p2_second_won"),
    p1_bp_saved: merge("p1_bp_saved"),
    p2_bp_saved: merge("p2_bp_saved"),
    p1_ret_won: merge("p1_ret_won"),
    p2_ret_won: merge("p2_ret_won"),
    p1_total_pts: merge("p1_total_pts"),
    p2_total_pts: merge("p2_total_pts"),
    _mock: false,
    perSet,
  };
}

export type UseTennisLiveStatsResult = {
  stats: TennisLiveStats | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  retry: () => void;
};

export function useTennisLiveStats(
  matchId: string,
): UseTennisLiveStatsResult {
  const [stats, setStats] = useState<TennisLiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const attemptRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    attemptRef.current = 0;
    hasDataRef.current = false;

    const fallbackToEmpty = (errMsg?: string) => {
      setStats(EMPTY_STATS);
      setLoading(false);
      setIsDemo(false);
      if (errMsg) setError(errMsg);
    };

    const applyPatch = (patch: LiveStreamMatch | undefined) => {
      if (patch && tnDataSentinel(patch as unknown as Record<string, unknown>)) {
        const normalized = tnNormalizeTennisStats(
          patch as unknown as Record<string, unknown>,
        );
        const parsed = TennisLiveStatsSchema.safeParse(normalized);
        if (parsed.success) {
          hasDataRef.current = true;
          setStats(parsed.data);
          setLoading(false);
          setError(null);
          setIsDemo(false);
          attemptRef.current = 0;
          return;
        }
      }

      // Match absent du flux live ou sans stats BSD : on laisse le flux tourner
      // (un match peut apparaître au prochain point). Fallback vide après 3
      // pushes sans données (~10-15s) — jamais avant, pour ne pas masquer une
      // vraie donnée qui arrive en retard.
      if (!hasDataRef.current) {
        attemptRef.current += 1;
        if (attemptRef.current >= 3) {
          fallbackToEmpty();
        }
      }
    };

    // Délai de secours : si le flux SSE ne se connecte pas du tout (EventSource
    // indisponible / serveur HS), on bascule en état vide après 6s au lieu de rester
    // en loading infini.
    const connectTimeout = setTimeout(() => {
      if (!hasDataRef.current) {
        fallbackToEmpty();
      }
    }, 6_000);

    const unsub = subscribeLiveStream(
      (payload) => {
        if (payload.kind === "snapshot") {
          const patch = payload.matches.find((m) => m.id === matchId);
          applyPatch(patch);
        } else {
          const patch = payload.matches.find((m) => m.id === matchId);
          applyPatch(patch);
        }
      },
      (status) => {
        if (status === "connected") {
          setError(null);
        }
      },
    );

    return () => {
      clearTimeout(connectTimeout);
      unsub();
    };
  }, [matchId, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { stats, loading, error, isDemo, retry };
}
