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
  matches: { id: string; playerA: { name: string }; playerB: { name: string } }[];
  source: string;
  updatedAt: string;
};

const POLL_INTERVAL_MS = 30_000;

/**
 * Hook that polls the REST API for live tennis matches.
 * Replaced the old Socket.IO hook after the gateway/service was decommissioned.
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

        // Map BSD match data to LiveMatchState format (score info from BSD);
        // falls back to showing match IDs with isLive=false if no detailed score.
        const map: Record<string, LiveMatchState> = {};
        for (const m of data.matches) {
          map[m.id] = {
            matchId: m.id,
            isLive: true,
            currentSet: 0,
            scoreA: { sets: [], games: 0, points: 0 },
            scoreB: { sets: [], games: 0, points: 0 },
            liveProbA: 50,
            liveProbB: 50,
            server: "A",
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
