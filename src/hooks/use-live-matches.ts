"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveStream } from "@/hooks/use-live-stream";

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
  /** R7.3 : vrai nom du tournoi BSD (remplace le fallback "Live"). */
  tournamentName?: string;
  /** R7.3 : round BSD (remplace le fallback "En direct"). */
  roundName?: string;
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

  // Détection de la disponibilité du SSE (une seule fois, au mount).
  // On utilise un state séparé pour éviter de conditionner le rendu pendant
  // l'initialisation (évite un flash de polling quand le SSE est dispo).
  const [sseActive, setSseActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // SSE dispo ? On l'active dès que la 1ère maj arrive (status connected).
    // Tant qu'aucune maj, on laisse le polling tourner pour ne pas rester à vide.
    if (stream.connectionStatus === "connected") {
      setSseActive(true);
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
        setConnectionStatus(data.matches.length > 0 ? "connected" : "connected");

        const rawList = data.matches.map((m) => ({
          id: m.id,
          playerA: m.playerA,
          playerB: m.playerB,
          isLive: m.isLive,
          tournamentName: m.tournamentName,
          roundName: m.roundName,
        }));
        setLiveMatchList(rawList);

        const map: Record<string, LiveMatchState> = {};
        for (const m of data.matches) {
          if (!m.isLive) continue;

          // FIX doublon score (2026-07-25) : cf. commentaire use-live-stream.ts.
          const completedCount = Math.min(m.currentSet, m.setsDetail.length - 1);
          const setsA: number[] = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p1);
          const setsB: number[] = m.setsDetail.slice(0, Math.max(0, completedCount)).map((s) => s.p2);

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

    setConnectionStatus("connecting");
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
