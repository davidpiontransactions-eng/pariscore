"use client";

// Client SSE partagé vers /api/tennis/live-stream.
//
// Problème : avant, chaque consommateur (useLiveStream, useTennisLiveStats) ouvrait
// son propre EventSource → N connexions par page pour une même donnée, et les stats
// faisaient carrément un canal socket.io dédié (Bun :3001) qui ne transportait pas
// les stats → jamais affichées.
//
// Solution : un EventSource UNIQUE par page, ref-counté. Le 1er subscriber l'ouvre,
// le dernier le ferme. Chaque payload (snapshot/update) est typé et dispatché à tous
// les listeners. Reconnexion native EventSource (retry auto sur coupure réseau).

export type LiveStreamMatch = {
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
  oddsA?: number | null;
  oddsB?: number | null;
  tournamentName?: string;
  roundName?: string;
  /** Stats live cumulées BSD (ajoutées dans bsd-fetcher). null si absentes. */
  live_stats?: Record<string, unknown> | null;
};

export type LiveStreamPayload =
  | { kind: "snapshot"; matches: LiveStreamMatch[]; at: number }
  | { kind: "update"; matches: LiveStreamMatch[] };

export type LiveStreamStatus = "connecting" | "connected" | "disconnected";

type StreamListener = (payload: LiveStreamPayload) => void;
type StatusListener = (status: LiveStreamStatus) => void;

type ClientState = {
  es: EventSource | null;
  listeners: Set<StreamListener>;
  statusListeners: Set<StatusListener>;
  status: LiveStreamStatus;
};

// Module-scoped singleton (un seul bundle client) — pas besoin de globalThis ici
// car le client ne tourne qu'une fois par page.
let client: ClientState | null = null;

function getClient(): ClientState {
  if (!client) {
    client = {
      es: null,
      listeners: new Set<StreamListener>(),
      statusListeners: new Set<StatusListener>(),
      status: "connecting",
    };
  }
  return client;
}

function setStatus(state: ClientState, status: LiveStreamStatus): void {
  if (state.status === status) return;
  state.status = status;
  for (const cb of state.statusListeners) {
    try {
      cb(status);
    } catch (err) {
      console.error("[live-stream-client] status listener threw:", (err as Error).message);
    }
  }
}

function closeIfIdle(state: ClientState): void {
  if (state.listeners.size === 0 && state.es) {
    state.es.close();
    state.es = null;
    setStatus(state, "disconnected");
  }
}

function ensureOpen(state: ClientState): void {
  if (typeof window === "undefined") return;
  if (state.es) return;
  if (typeof window.EventSource === "undefined") return;

  const es = new EventSource("/api/tennis/live-stream");
  state.es = es;
  setStatus(state, "connecting");

  es.addEventListener("open", () => {
    if (state.es !== es) return;
    setStatus(state, "connected");
  });

  es.addEventListener("snapshot", (e: MessageEvent) => {
    if (state.es !== es) return;
    try {
      const data = JSON.parse(e.data) as { matches: LiveStreamMatch[]; at: number };
      const payload: LiveStreamPayload = {
        kind: "snapshot",
        matches: Array.isArray(data.matches) ? data.matches : [],
        at: typeof data.at === "number" ? data.at : Date.now(),
      };
      for (const cb of state.listeners) {
        try {
          cb(payload);
        } catch (err) {
          console.error("[live-stream-client] listener threw:", (err as Error).message);
        }
      }
    } catch (err) {
      console.error("[live-stream-client] snapshot parse error:", err);
    }
  });

  es.addEventListener("update", (e: MessageEvent) => {
    if (state.es !== es) return;
    try {
      const data = JSON.parse(e.data) as { matches: LiveStreamMatch[] };
      const payload: LiveStreamPayload = {
        kind: "update",
        matches: Array.isArray(data.matches) ? data.matches : [],
      };
      for (const cb of state.listeners) {
        try {
          cb(payload);
        } catch (err) {
          console.error("[live-stream-client] listener threw:", (err as Error).message);
        }
      }
    } catch (err) {
      console.error("[live-stream-client] update parse error:", err);
    }
  });

  es.addEventListener("error", () => {
    if (state.es !== es) return;
    // EventSource se reconnecte tout seul (retry natif). Statut visuel le temps
    // que la reconnexion reprenne.
    setStatus(state, "disconnected");
  });
}

/**
 * S'abonne au flux SSE partagé. Retourne la fonction de désabonnement.
 * @param listener Reçoit chaque snapshot/update typé (matchs bruts + at).
 * @param onStatus Optionnel : statut de connexion (connecting/connected/disconnected).
 */
export function subscribeLiveStream(
  listener: StreamListener,
  onStatus?: StatusListener,
): () => void {
  const state = getClient();
  state.listeners.add(listener);
  if (onStatus) state.statusListeners.add(onStatus);

  ensureOpen(state);

  return () => {
    state.listeners.delete(listener);
    if (onStatus) state.statusListeners.delete(onStatus);
    closeIfIdle(state);
  };
}

/** Statut courant de la connexion partagée. */
export function getLiveStreamStatus(): LiveStreamStatus {
  return getClient().status;
}