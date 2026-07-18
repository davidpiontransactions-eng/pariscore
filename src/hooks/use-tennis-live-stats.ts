"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";

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

const DEMO_STATS: TennisLiveStats = {
  p1_aces: 5,
  p2_aces: 2,
  p1_df: 1,
  p2_df: 4,
  p1_first_pct: 65,
  p2_first_pct: 64,
  p1_first_won: 72,
  p2_first_won: 77,
  p1_bp_saved: 5,
  p2_bp_saved: 1,
  p1_ret_won: 37,
  p2_ret_won: 39,
  p1_total_pts: 50,
  p2_total_pts: 50,
  _mock: true,
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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    attemptRef.current = 0;

    const socket = io("/?XTransformPort=3001", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    const fallbackToDemo = (errMsg?: string) => {
      setStats(DEMO_STATS);
      setLoading(false);
      setIsDemo(true);
      if (errMsg) setError(errMsg);
    };

    const handleConnect = () => {
      setError(null);
    };

    const handleConnectError = (err: Error) => {
      attemptRef.current += 1;
      if (attemptRef.current >= 3) {
        fallbackToDemo(err.message);
      }
    };

    const handleLivePatch = (
      data: Record<string, unknown>,
    ) => {
      const patches = data?.patches as Record<string, unknown>[] | undefined;
      if (!patches?.length) return;

      const patch = patches.find((p) => p.id === matchId);
      if (!patch) return;

      if (tnDataSentinel(patch)) {
        const normalized = tnNormalizeTennisStats(patch);
        const parsed = TennisLiveStatsSchema.safeParse(normalized);
        if (parsed.success) {
          setStats(parsed.data);
          setLoading(false);
          setError(null);
          setIsDemo(false);
          attemptRef.current = 0;
          return;
        }
      }

      attemptRef.current += 1;
      if (attemptRef.current >= 3) {
        fallbackToDemo();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("live_patch", handleLivePatch);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("live_patch", handleLivePatch);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { stats, loading, error, isDemo, retry };
}
