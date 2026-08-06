"use client";

// Hook client des cotes live 1xBet (avec repli BSD).
//
// Architecture (Engineering Loop) :
//   - Un seul POST batch /api/v1/odds/live toutes les 15s pour TOUS les
//     matchs live affichés (pas N requêtes par carte).
//   - Résolution par carte : 1xBet quand la route renvoie une cote, sinon
//     repli sur les cotes BSD déjà présentes dans `liveStates` (oddsA/oddsB).
//   - Identité-stable : un slot inchangé réutilise le MÊME objet → les cartes
//     memoïsées (MatchCardBroadcast via MemoMatchCardBroadcastItem) ne se
//     re-renderent pas quand seul un autre match a bougé.
//   - Direction pour le flash UI : compare la cote au dernier batch.

import { useEffect, useRef, useState } from "react";
import type { LiveMatchState } from "@/hooks/use-live-matches";

export type LiveResolvedOdds = {
  matchId: string;
  source: "onex" | "bsd";
  oddA: number | null;
  oddB: number | null;
  dirA: "up" | "down" | null;
  dirB: "up" | "down" | null;
  updatedAt: number;
};

export type OnexProviderState = "pending" | "onex" | "bsd" | "disabled";

export type OnexLiveOdds = {
  odds: Record<string, LiveResolvedOdds>;
  provider: OnexProviderState;
  lastTickAt: number | null;
};

export type OnexLiveRequest = Array<{
  matchId: string;
  nameA: string;
  nameB: string;
}>;

const POLL_MS = 15_000;

const EMPTY: Record<string, LiveResolvedOdds> = {};

function fieldsEqual(a: LiveResolvedOdds, b: LiveResolvedOdds): boolean {
  return (
    a.source === b.source &&
    a.oddA === b.oddA &&
    a.oddB === b.oddB &&
    a.dirA === b.dirA &&
    a.dirB === b.dirB
  );
}

export function useOnexLiveOdds(
  liveRequest: OnexLiveRequest,
  liveStates: Record<string, LiveMatchState>,
): OnexLiveOdds {
  const [odds, setOdds] = useState<Record<string, LiveResolvedOdds>>(EMPTY);
  const [provider, setProvider] = useState<OnexProviderState>("pending");
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  const prevRef = useRef<Record<string, LiveResolvedOdds>>({});
  const reqRef = useRef(liveRequest);
  const liveStatesRef = useRef(liveStates);
  reqRef.current = liveRequest;
  liveStatesRef.current = liveStates;

  useEffect(() => {
    const ctrlMain = new AbortController();
    let disposed = false;

    const poll = async () => {
      const req = reqRef.current;
      const states = liveStatesRef.current;
      if (req.length === 0) return;

      const body = JSON.stringify({
        matches: req.map((m) => ({
          matchId: m.matchId,
          playerA: m.nameA,
          playerB: m.nameB,
        })),
      });

      let source: "onex" | "bsd" | "disabled" | "down" = "down";
      let onexOdds: Record<string, { oddA: number; oddB: number }> = {};
      try {
        const res = await fetch("/api/v1/odds/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: ctrlMain.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as {
            source?: "onex" | "disabled" | "down";
            odds?: Record<string, { oddA: number; oddB: number }>;
          };
          source = json.source ?? "down";
          onexOdds = json.odds ?? {};
        }
      } catch {
        source = "down";
      }

      if (source === "disabled") setProvider("disabled");
      else if (source === "onex") setProvider("onex");
      else setProvider("bsd");

      const prevEntries = prevRef.current;
      const next: Record<string, LiveResolvedOdds> = {};

      for (const m of req) {
        const prev = prevEntries[m.matchId];
        const onex = onexOdds[m.matchId];
        const bsdState = states[m.matchId];

        let source: "onex" | "bsd" = "bsd";
        let oddA: number | null = bsdState?.oddsA ?? null;
        let oddB: number | null = bsdState?.oddsB ?? null;
        if (onex && onex.oddA > 0 && onex.oddB > 0) {
          source = "onex";
          oddA = onex.oddA;
          oddB = onex.oddB;
        }
        if (oddA == null && oddB == null) continue;

        const dirA =
          prev && prev.oddA != null && oddA != null
            ? oddA > prev.oddA
              ? "up"
              : oddA < prev.oddA
                ? "down"
                : null
            : null;
        const dirB =
          prev && prev.oddB != null && oddB != null
            ? oddB > prev.oddB
              ? "up"
              : oddB < prev.oddB
                ? "down"
                : null
            : null;

        const candidate: LiveResolvedOdds = {
          matchId: m.matchId,
          source,
          oddA,
          oddB,
          dirA,
          dirB,
          updatedAt: Date.now(),
        };
        // Re-cut si l'objet précédent est déjà à jour → identité stable.
        next[m.matchId] = prev && fieldsEqual(prev, candidate) ? prev : candidate;
      }

      prevRef.current = next;
      if (!disposed) {
        setOdds(next);
        setLastTickAt(Date.now());
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
      ctrlMain.abort();
    };
  }, []);

  return { odds, provider, lastTickAt };
}