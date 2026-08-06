"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveStream } from "@/hooks/use-live-stream";
import {
  buildLiveStates,
  emptyLiveStateCache,
  type LiveMatchState,
  type RawLiveMatch,
} from "@/lib/live-state-builder";

// v6ka : SideScore/LiveMatchState définis dans live-state-builder.ts (source de
// vérité partagée SSE + polling). Ré-exportés ici pour compat des consommateurs.
export type { LiveMatchState, SideScore } from "@/lib/live-state-builder";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type UseLiveMatchesResult = {
  liveStates: Record<string, LiveMatchState>;
  /** Basic info for each live match (id + player names). Used by TennisTabContent
   *  to create synthetic cards for matches not present in prematch data.
   *  R7.3 : inclut tournamentName + roundName depuis BSD live. */
  liveMatchList: Array<{
    id: string;
    playerA: { name: string };
    playerB: { name: string };
    isLive: boolean;
    tournamentName?: string;
    roundName?: string;
  }>;
  connectionStatus: ConnectionStatus;
  latency: number;
};

export type LiveMatchResponseItem = {
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
  /** Cotes décimales live BSD (depuis odds_player1/2). */
  oddsA?: number | null;
  oddsB?: number | null;
  /** R7.3 : vrai nom du tournoi BSD (remplace le fallback "Live"). */
  tournamentName?: string;
  /** R7.3 : round BSD (remplace le fallback "En direct"). */
  roundName?: string;
  /** Stats live cumulées BSD (R9) — null si absentes. Consommées par
   *  use-tennis-live-stats (via le flux SSE partagé). */
  live_stats?: Record<string, unknown> | null;
};

type TennisLiveResponse = {
  matches: LiveMatchResponseItem[];
  source: string;
  updatedAt: string;
};

// R6 hotfix (2026-07-21) : réduit de 30s à 8s pour permettre au MomentumDR
// de capter des points entre polls. Sans ça, le diff entre snapshots
// (5-15 points joués en 30s) rend l'algorithme inopérant — le buffer ne
// se remplit jamais, settled reste false, le composant affiche 50/50.
// Charge BSD × 4 (ticket suivi R6 #2 pour monitoring post-deploy).
const POLL_INTERVAL_MS = 8_000;

/**
 * Hook that polls the REST API for live tennis matches.
 * Live data comes from BSD /api/v2/matches/live/ proxied through /api/tennis/live.
 * IDs are normalized as bsd-<rawId> to match prematch IDs from usePrematchMatches.
 */
export function useLiveMatches(): UseLiveMatchesResult {
  // R8 (2026-07-28) : délègue au SSE temps réel si EventSource dispo, sinon
  // fallback polling REST 8s. Le SSE pousse les maj < 1s (broker fan-out),
  // idéal pour le widget Document PiP qui doit réagir à chaque point.
  // Les 2 hooks ayant la MÊME signature, on peut switcher sans modifier
  // aucun consommateur (tennis-tab-content, match-card, etc.).
  const stream = useLiveStream();

  const [liveStates, setLiveStates] = useState<Record<string, LiveMatchState>>({});
  const [liveMatchList, setLiveMatchList] = useState<Array<{
    id: string;
    playerA: { name: string };
    playerB: { name: string };
    isLive: boolean;
    tournamentName?: string;
    roundName?: string;
  }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // v6ka : cache identity-stable du polling (même mécanique que le SSE) —
  // un poll sans changement de score réutilise les objets → pas de re-render
  // de la grille memoïsée à chaque tick 8s (cf. live-state-builder.ts).
  const prevCacheRef = useRef(emptyLiveStateCache());

  // Détection de la disponibilité du SSE (une seule fois, au mount).
  // On utilise un state séparé pour éviter de conditionner le rendu pendant
  // l'initialisation (évite un flash de polling quand le SSE est dispo).
  const [sseActive, setSseActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // SSE dispo ? On l'active dès que la 1ère maj arrive (status connected).
    // Tant qu'aucune maj, on laisse le polling tourner pour ne pas rester à vide.
    if (stream.connectionStatus === "connected") {
      Promise.resolve().then(() => setSseActive(true));
    }
  }, [stream.connectionStatus]);

  // C1 fix : reset sseActive on disconnect pour débloquer le polling fallback.
  useEffect(() => {
    if (stream.connectionStatus === "disconnected") {
      Promise.resolve().then(() => setSseActive(false));
    }
  }, [stream.connectionStatus]);

  // Polling REST — fallback uniquement si SSE inactif (Firefox/Safari anciens,
  // ou serveur SSE HS). Code identique au comportement pré-R8.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sseActive) return; // SSE prend le relais, on arrête le polling

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
        setConnectionStatus("connected");

        // v6ka : construction identity-stable via le builder partagé (SSE + polling).
        // Un poll sans changement de score réutilise les objets → pas de re-render
        // de la grille memoïsée à chaque tick 8s (cf. live-state-builder.ts).
        const raw: RawLiveMatch[] = data.matches;
        const cache = buildLiveStates(raw, data.updatedAt, prevCacheRef.current);
        prevCacheRef.current = cache;
        setLiveMatchList(Array.from(cache.list.values()));
        setLiveStates(cache.states);
      } catch {
        setConnectionStatus("disconnected");
      }
    };

    Promise.resolve().then(() => setConnectionStatus("connecting"));
    poll();

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sseActive]);

  // Si SSE actif, on retourne les données du stream. Sinon, les states locaux
  // du polling fallback. Les 2 chemins exposent la même interface.
  if (sseActive) {
    return stream;
  }
  return { liveStates, liveMatchList, connectionStatus, latency };
}
