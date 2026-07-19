"use client";

import { useEffect, useRef, useState } from "react";

export type SideScore = {
  sets: number[];
  games: number;
  points: number;
};

export type LiveMatchState = {
  matchId: string;
  isLive: boolean;
  currentSet: number;
  scoreA: SideScore;
  scoreB: SideScore;
  liveProbA: number;
  liveProbB: number;
  server: "A" | "B";
  lastUpdate: string;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type UseLiveMatchesResult = {
  liveStates: Record<string, LiveMatchState>;
  connectionStatus: ConnectionStatus;
  latency: number;
};

type TennisLiveResponse = {
  matches: Array<{
    id: string;
    playerA: { name: string };
    playerB: { name: string };
    setsDetail: Array<{ p1: number; p2: number }>;
    currentGame: { p1: number; p2: number };
    currentPoint: { p1: number; p2: number };
    currentSet: number;
    server: "A" | "B";
    liveProbA: number;
    liveProbB: number;
    isLive: boolean;
  }>;
  source: string;
  updatedAt: string;
};

const POLL_INTERVAL_MS = 30_000;

/**
 * Hook that polls the REST API for live tennis matches.
 * Live data comes from BSD /api/v2/matches/live/ proxied through /api/tennis/live.
 * IDs are normalized as bsd-<rawId> to match prematch IDs from usePrematchMatches.
 */
export function useLiveMatches(): UseLiveMatchesResult {
  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const poll = async () => {
      const t0 = Date.now();
      try {
        const res = await fetch("/api/tennis/live");
        if (!res.ok) {
          setConnectionStatus("disconnected");
          return;
        }
        const data: TennisLiveResponse = await res.json();
        setLatency(Date.now() - t0);
        setConnectionStatus(data.matches.length > 0 ? "connected" : "connected");

        // Map BSD live match data to LiveMatchState format.
        // IDs are bsd-<rawId> which matches the prematch ID format from fetchBSDMatches()
        // (see buildMatch() in bsd-fetcher.ts: id: `bsd-${b.id ?? index}`).
        const map: Record<string, LiveMatchState> = {};
        for (const m of data.matches) {
          if (!m.isLive) continue;

          // Build per-set game-score arrays from setsDetail
          const setsA: number[] = m.setsDetail.map((s) => s.p1);
          const setsB: number[] = m.setsDetail.map((s) => s.p2);

          map[m.id] = {
            matchId: m.id,
            isLive: true,
            currentSet: m.currentSet,
            scoreA: { sets: setsA, games: m.currentGame.p1, points: m.currentPoint.p1 },
            scoreB: { sets: setsB, games: m.currentGame.p2, points: m.currentPoint.p2 },
            liveProbA: m.liveProbA,
            liveProbB: m.liveProbB,
            server: m.server,
            lastUpdate: data.updatedAt,
          };
        }
        setLiveStates(map);
      } catch {
        setConnectionStatus("disconnected");
      }
    };

    // Initial poll
    setConnectionStatus("connecting");
    poll();

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { liveStates, connectionStatus, latency };
}
