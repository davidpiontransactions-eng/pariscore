"use client";

import { useMemo } from "react";
import { useEloHistory } from "@/hooks/use-elo-history";

/**
 * Extract the last N Elo points for a player from the elo-history API.
 * Returns a sparkline-ready array of numbers.
 */
export function useEloSparkline(matchId: string | null, player: "a" | "b", points = 30) {
  const { data } = useEloHistory(matchId);

  return useMemo(() => {
    if (!data) return [];
    const history = player === "a" ? data.a.history : data.b.history;
    if (history.length === 0) return [];
    // Take last N points
    const sliced = history.slice(-points);
    return sliced.map((p) => p.elo);
  }, [data, player, points]);
}
