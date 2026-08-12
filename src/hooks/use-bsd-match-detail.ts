"use client";

import { useState, useEffect } from "react";
import type { BSDMatch, BSDOdds, BSDH2H } from "@/lib/bsd-tennis-service";
import { parseBsdId } from "@/lib/bsd-id";

export type BSDMatchDetail = {
  match: BSDMatch | null;
  odds: BSDOdds | null;
  h2h: BSDH2H | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Hook qui charge les données détaillées BSD V2 pour un match :
 * - Détail match (serve stats, sets, aces...)
 * - Odds par bookmaker
 * - Head-to-head avec historique
 */
export function useBSDMatchDetail(matchId: string | null): BSDMatchDetail {
  const [state, setState] = useState<BSDMatchDetail>({
    match: null,
    odds: null,
    h2h: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!matchId) {
      setState({ match: null, odds: null, h2h: null, isLoading: false, error: null });
      return;
    }

    const bsdId = parseBsdId(matchId);
    if (!bsdId) {
      setState((s) => ({ ...s, error: "Invalid match ID", isLoading: false }));
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const load = async () => {
      try {
        const [matchRes, oddsRes, h2hRes] = await Promise.allSettled([
          fetch(`/api/tennis/bsd/matches/${bsdId}`),
          fetch(`/api/tennis/bsd/matches/${bsdId}/odds`),
          fetch(`/api/tennis/bsd/matches/${bsdId}/h2h`),
        ]);

        if (cancelled) return;

        const match = matchRes.status === "fulfilled" && matchRes.value.ok
          ? (await matchRes.value.json() as BSDMatch)
          : null;

        const odds = oddsRes.status === "fulfilled" && oddsRes.value.ok
          ? (await oddsRes.value.json() as BSDOdds)
          : null;

        const h2h = h2hRes.status === "fulfilled" && h2hRes.value.ok
          ? (await h2hRes.value.json() as BSDH2H)
          : null;

        setState({ match, odds, h2h, isLoading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, isLoading: false, error: (err as Error).message }));
        }
      }
    };

    load();

    return () => { cancelled = true; };
  }, [matchId]);

  return state;
}
