"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

// ─── Types (mirrors the server's LiveMatchState in mini-services/tennis-live/index.ts) ─

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

// ─── Hook ────────────────────────────────────────────────────────────────────
//
// Connects to the tennis-live mini-service via the gateway:
//   io("/?XTransformPort=3001")
// NEVER use http://localhost:3001 — the gateway (Caddyfile) rewrites the
// XTransformPort query param to route to the correct backend port.
//
// All setState calls live inside socket event callbacks (never in the
// synchronous effect body), satisfying the react-hooks/set-state-in-effect
// rule enforced by React 19.

export function useLiveMatches(): UseLiveMatchesResult {
  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // SSR guard: skip socket init on the server.
    if (typeof window === "undefined") return;

    const socket = io("/?XTransformPort=3001", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    // Latency probe state — kept in refs so the pong handler can read the
    // timestamp of the last outgoing ping without re-subscribing.
    let pingSentAt = 0;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const handleConnect = () => setConnectionStatus("connected");
    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      setLatency(0);
    };
    const handleReconnectAttempt = () => setConnectionStatus("connecting");
    const handleReconnect = () => setConnectionStatus("connected");

    const handleInitialState = (states: LiveMatchState[]) => {
      if (!Array.isArray(states)) return;
      const map: Record<string, LiveMatchState> = {};
      for (const s of states) map[s.matchId] = s;
      setLiveStates(map);
    };

    const handleMatchUpdate = (state: LiveMatchState) => {
      if (!state || typeof state.matchId !== "string") return;
      setLiveStates((prev) => ({ ...prev, [state.matchId]: state }));
    };

    const handlePong = () => {
      if (pingSentAt > 0) {
        const rtt = Date.now() - pingSentAt;
        setLatency(rtt);
        pingSentAt = 0;
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect", handleReconnect);
    socket.on("initial_state", handleInitialState);
    socket.on("match_update", handleMatchUpdate);
    socket.on("pong", handlePong);

    // Probe latency every 5s. Skipped when socket is not connected.
    pingTimer = setInterval(() => {
      if (socket.connected) {
        pingSentAt = Date.now();
        socket.emit("ping", { t: pingSentAt });
      }
    }, 5_000);

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("reconnect", handleReconnect);
      socket.off("initial_state", handleInitialState);
      socket.off("match_update", handleMatchUpdate);
      socket.off("pong", handlePong);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { liveStates, connectionStatus, latency };
}
