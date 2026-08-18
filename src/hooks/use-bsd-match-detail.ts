"use client";

import { useState, useEffect } from "react";
import type {
  BSDMatch,
  BSDOdds,
  BSDH2H,
  BSDPrediction,
  BSDPointByPoint,
} from "@/lib/bsd-tennis-service";
import { parseBsdId } from "@/lib/bsd-id";

export type BSDMatchDetail = {
  match: BSDMatch | null;
  odds: BSDOdds | null;
  h2h: BSDH2H | null;
  prediction: BSDPrediction | null;
  pointByPoint: BSDPointByPoint | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Hook qui charge les données détaillées BSD V2 pour un match :
 * - Détail match (serve stats, sets, aces...)
 * - Odds par bookmaker
 * - Head-to-head avec historique
 * - Prédiction du modèle BSD (probabilités + confidence)
 * - Point-by-point (séquence de points par jeu)
 */
export function useBSDMatchDetail(matchId: string | null): BSDMatchDetail {
  const [state, setState] = useState<BSDMatchDetail>({
    match: null,
    odds: null,
    h2h: null,
    prediction: null,
    pointByPoint: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!matchId) {
      setState({
        match: null,
        odds: null,
        h2h: null,
        prediction: null,
        pointByPoint: null,
        isLoading: false,
        error: null,
      });
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
        const [matchRes, oddsRes, h2hRes, predictionRes, pbpRes] =
          await Promise.allSettled([
            fetch(`/api/tennis/bsd/matches/${bsdId}`),
            fetch(`/api/tennis/bsd/matches/${bsdId}/odds`),
            fetch(`/api/tennis/bsd/matches/${bsdId}/h2h`),
            fetch(`/api/tennis/bsd/predictions?match=${bsdId}`),
            fetch(`/api/tennis/bsd/matches/${bsdId}/point-by-point`),
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

        let prediction: BSDPrediction | null = null;
        if (predictionRes.status === "fulfilled" && predictionRes.value.ok) {
          const data = await predictionRes.value.json();
          const list = Array.isArray(data)
            ? data
            : ((data as { results?: BSDPrediction[] }).results ?? []);
          // NB : l'API BSD ignore le param `match` quand `upcoming=true` — elle
        // renvoie la liste complète des prédictions à venir. On ne garde que la
        // prédiction du match demandé ; sans elle, pas de bloc (pas de faux
        // signal avec la prédiction d'un autre match).
        prediction = list.find(
          (p) => (typeof p.match === "object" ? p.match?.id : p.match) === bsdId
        ) ?? null;
        }

        let pointByPoint: BSDPointByPoint | null = null;
        if (pbpRes.status === "fulfilled" && pbpRes.value.ok) {
          const data = await pbpRes.value.json();
          if (data && data.available) pointByPoint = data;
        }

        setState({
          match,
          odds,
          h2h,
          prediction,
          pointByPoint,
          isLoading: false,
          error: null,
        });
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
