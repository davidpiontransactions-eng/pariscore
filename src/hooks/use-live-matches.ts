"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveStream } from "@/hooks/use-live-stream";
import { subscribeLiveStream } from "@/lib/live-stream-client";
import {
  buildLiveStates,
  emptyLiveStateCache,
  type LiveMatchState,
  type RawLiveMatch,
} from "@/lib/live-state-builder";
import type { CalculatedLiveMetrics } from "@/lib/tennis-live-metrics";

// v6ka : SideScore/LiveMatchState définis dans live-state-builder.ts (source de
// vérité partagée SSE + polling). Ré-exportés ici pour compat des consommateurs.
export type { LiveMatchState, SideScore } from "@/lib/live-state-builder";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type UseLiveMatchesResult = {
  liveStates: Record<string, LiveMatchState>;
  /** Basic info for each live match (id + player names). Used by TennisTabContent
   *  to create synthetic cards for matches not present in prematch data.
   *  R7.3 : inclut tournamentName + roundName depuis BSD live.
   *  R10 : inclut calculated metrics (DR, alertes) pour les badges de décision. */
  liveMatchList: Array<{
    id: string;
    playerA: { name: string };
    playerB: { name: string };
    isLive: boolean;
    tournamentName?: string;
    roundName?: string;
    calculated?: CalculatedLiveMetrics;
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
  /** Métriques calculées (DR, alertes, hold prob) — ajoutées par /api/tennis/live. */
  calculated?: CalculatedLiveMetrics;
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
  // IMPORTANT : on attend d'avoir des DONNÉES (liveMatchList non vide) avant de
  // basculer sur SSE, sinon le polling s'arrête avant le 1er snapshot (~5-30s).
  const [sseActive, setSseActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // SSE dispo ET a reçu des données ? On l'active.
    // `stream.liveMatchList` est peuplé dès le 1er snapshot reçu.
    if (stream.connectionStatus === "connected" && stream.liveMatchList.length > 0) {
      Promise.resolve().then(() => setSseActive(true));
    }
  }, [stream.connectionStatus, stream.liveMatchList.length]);

  // C1 fix : reset sseActive on disconnect pour débloquer le polling fallback.
  useEffect(() => {
    if (stream.connectionStatus === "disconnected") {
      Promise.resolve().then(() => setSseActive(false));
    }
  }, [stream.connectionStatus]);

  // Polling REST — source principale fiable (tous navigateurs, pas de SSE needed).
  // Le SSE est une amélioration <1s mais le polling est toujours disponible (8s).
  // On lance toujours le polling en premier, et le SSE améliore la latence
  // sans remplacer les données polling.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Démarrer le polling en premier (toujours, indépendamment de SSE)
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

        // Construction identity-stable des états live
        const raw: RawLiveMatch[] = data.matches;
        const cache = buildLiveStates(raw, data.updatedAt, prevCacheRef.current);
        prevCacheRef.current = cache;
        setLiveMatchList(Array.from(cache.list.values()));
        setLiveStates(cache.states);
      } catch {
        setConnectionStatus("disconnected");
      }
    };

    // 2. Puis initialiser SSE comme amélioration optionnelle (pas de remplacement)
    if (typeof window.EventSource !== "undefined") {
      const unsub = subscribeLiveStream(
        (payload) => {
          // SSE: uniquement mettre à jour si polling n'a pas déjà de données
          // (liveMatchList.length === 0 signifie pas encore de données polling)
          if (liveMatchList.length === 0) {
            const latencyMs = Math.max(0, Date.now() - (payload.at ? new Date(payload.at).getTime() : Date.now()));
            const cache = buildLiveStates(payload.matches, payload.at ? new Date(payload.at).toISOString() : undefined, prevCacheRef.current);
            prevCacheRef.current = cache;
            setLatency(latencyMs);
            setConnectionStatus("connected");
            setLiveStates(cache.states);
            setLiveMatchList(Array.from(cache.list.values()));
          }
        },
        (status) => {
          setConnectionStatus(status);
        },
      );
      // Ne pas return unsub ici - on veut que SSE tourne en parallèle
    }

    // 3. Lancer le polling immédiatement
    poll();

    // 4. Intervalle de polling toujours actif
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);  // Empty deps: polling s'exécute toujours, pas de dépendance SSE

  // Si SSE actif, on retourne les données du stream. Sinon, les states locaux
  // du polling fallback. Les 2 chemins exposent la même interface.
  if (sseActive) {
    return stream;
  }
  return { liveStates, liveMatchList, connectionStatus, latency };
}
