"use client";

// Client SSE pour /api/tennis/live-stream.
//
// Même signature de retour que `useLiveMatches` ({liveStates, liveMatchList,
// connectionStatus, latency}) → drop-in. `useLiveMatches` délègue à ce hook
// quand EventSource est dispo, et bascule sur le polling REST sinon.
//
// Avantage vs polling 8s : maj < 1s (broker pousse immédiatement sur changement
// de score). Reconnexion native EventSource (retry automatique réseau coupé).

import { useEffect, useRef, useState } from "react";
import type {
  ConnectionStatus,
  LiveMatchState,
  UseLiveMatchesResult,
} from "@/hooks/use-live-matches";
import type { LiveMatchResponseItem } from "@/hooks/use-live-matches";

type SnapshotPayload = {
  matches: LiveMatchResponseItem[];
  at: number;
};

type UpdatePayload = {
  matches: LiveMatchResponseItem[];
};

/**
 * Convertit une liste de `LiveMatchResponseItem` (format brut BSD proxé) en
 * `LiveMatchState` indexé par matchId. Logique dupliquée depuis `useLiveMatches`
 * (polling) pour garder les 2 chemins indépendants — toute évolution du mapping
 * doit être répercutée des 2 côtés.
 */
function buildLiveStates(
  matches: LiveMatchResponseItem[],
  updatedAt: string,
): { states: Record<string, LiveMatchState>; list: UseLiveMatchesResult["liveMatchList"] } {
  const states: Record<string, LiveMatchState> = {};
  const list: UseLiveMatchesResult["liveMatchList"] = [];

  for (const m of matches) {
    list.push({
      id: m.id,
      playerA: m.playerA,
      playerB: m.playerB,
      isLive: m.isLive,
      tournamentName: m.tournamentName,
      roundName: m.roundName,
    });

    if (!m.isLive) continue;

    // FIX doublon score : cf. use-live-matches.ts:127-136 (même logique).
    const completedCount = Math.min(m.currentSet, (m.setsDetail?.length ?? 0) - 1);
    const setsA = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p1);
    const setsB = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p2);

    states[m.id] = {
      matchId: m.id,
      isLive: true,
      currentSet: m.currentSet,
      scoreA: { sets: setsA, games: m.currentGame.p1, points: m.currentPoint.p1 },
      scoreB: { sets: setsB, games: m.currentGame.p2, points: m.currentPoint.p2 },
      liveProbA: m.liveProbA,
      liveProbB: m.liveProbB,
      oddsA: m.oddsA ?? null,
      oddsB: m.oddsB ?? null,
      server: m.server,
      lastUpdate: updatedAt,
    };
  }

  return { states, list };
}

export function useLiveStream(): UseLiveMatchesResult {
  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [liveMatchList, setLiveMatchList] = useState<UseLiveMatchesResult["liveMatchList"]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState(0);
  const lastUpdateRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Feature detection : si EventSource absent (très vieux navigateur), on
    // ne fait rien — c'est `useLiveMatches` qui gérera le fallback polling.
    if (typeof window.EventSource === "undefined") return;

    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource("/api/tennis/live-stream");
      setConnectionStatus("connecting");

      es.addEventListener("open", () => {
        if (closed) return;
        setConnectionStatus("connected");
      });

      es.addEventListener("snapshot", (e: MessageEvent) => {
        if (closed) return;
        try {
          const payload = JSON.parse(e.data) as SnapshotPayload;
          const updatedAt = new Date(payload.at || Date.now()).toISOString();
          lastUpdateRef.current = updatedAt;
          setLatency(Math.max(0, Date.now() - payload.at));
          const { states, list } = buildLiveStates(payload.matches, updatedAt);
          setLiveStates(states);
          setLiveMatchList(list);
          setConnectionStatus(payload.matches.length > 0 ? "connected" : "connected");
        } catch (err) {
          console.error("[live-stream] snapshot parse error:", err);
        }
      });

      es.addEventListener("update", (e: MessageEvent) => {
        if (closed) return;
        try {
          const payload = JSON.parse(e.data) as UpdatePayload;
          const updatedAt = new Date().toISOString();
          lastUpdateRef.current = updatedAt;
          setLatency(0); // push broker = latence réseau négligeable
          const { states, list } = buildLiveStates(payload.matches, updatedAt);
          setLiveStates(states);
          setLiveMatchList(list);
        } catch (err) {
          console.error("[live-stream] update parse error:", err);
        }
      });

      es.addEventListener("error", () => {
        if (closed) return;
        // EventSource se reconnecte tout seul (retry natif). On bascule juste
        // le statut visuel le temps que la reconnexion reprenne.
        setConnectionStatus("disconnected");
      });
    };

    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, []);

  return { liveStates, liveMatchList, connectionStatus, latency };
}
