"use client";

// Client SSE pour /api/tennis/live-stream.
//
// Même signature de retour que `useLiveMatches` ({liveStates, liveMatchList,
// connectionStatus, latency}) → drop-in. `useLiveMatches` délègue à ce hook
// quand EventSource est dispo, et bascule sur le polling REST sinon.
//
// Avantage vs polling 8s : maj < 1s (broker pousse immédiatement sur changement
// de score). Reconnexion native EventSource (retry automatique réseau coupé).
//
// R9 (latence live) : le flux passe par `subscribeLiveStream` (EventSource unique
// partagé, cf. live-stream-client.ts) — plus 1 connexion par consommateur. La
// construction des états est IDENTITY-STABLE : un match dont la signature n'a pas
// bougé réutilise l'objet `LiveMatchState` précédent → les cartes mémosées
// (match-card-broadcast) SAUTENT le re-render pour les matchs inchangés.
//
// v6ka (2026-08-05) : la logique identity-stable est extraite dans
// `live-state-builder.ts` et partagée avec le chemin polling fallback
// (use-live-matches.ts) — le fallback reconstruisait tout à chaque poll 8s.

import { useEffect, useRef, useState } from "react";
import {
  subscribeLiveStream,
  type LiveStreamMatch,
  type LiveStreamStatus,
} from "@/lib/live-stream-client";
import {
  buildLiveStates,
  emptyLiveStateCache,
} from "@/lib/live-state-builder";
import type {
  ConnectionStatus,
  LiveMatchState,
  UseLiveMatchesResult,
} from "@/hooks/use-live-matches";

type ListItem = UseLiveMatchesResult["liveMatchList"][number];

export function useLiveStream(): UseLiveMatchesResult {
  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [liveMatchList, setLiveMatchList] = useState<ListItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState(0);
  const prevCacheRef = useRef(emptyLiveStateCache());

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Feature detection : si EventSource absent (très vieux navigateur), on ne
    // fait rien — c'est `useLiveMatches` qui gérera le fallback polling.
    if (typeof window.EventSource === "undefined") return;

    const apply = (
      matches: LiveStreamMatch[],
      updatedAt: string,
      latencyMs: number,
    ) => {
      const cache = buildLiveStates(matches, updatedAt, prevCacheRef.current);
      prevCacheRef.current = cache;
      setLatency(latencyMs);
      setConnectionStatus("connected");
      setLiveStates(cache.states);
      setLiveMatchList(Array.from(cache.list.values()));
    };

    const unsub = subscribeLiveStream(
      (payload) => {
        if (payload.kind === "snapshot") {
          const updatedAt = new Date(payload.at || Date.now()).toISOString();
          apply(payload.matches, updatedAt, Math.max(0, Date.now() - payload.at));
        } else {
          // push broker ≈ latence réseau négligeable (évite un affichage trompeur).
          apply(payload.matches, new Date().toISOString(), 0);
        }
      },
      (status) => {
        setConnectionStatus(status);
      },
    );

    return unsub;
  }, []);

  return { liveStates, liveMatchList, connectionStatus, latency };
}
