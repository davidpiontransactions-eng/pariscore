"use client";

import { useEffect, useState } from "react";
import type { FootballMatch } from "@/lib/football-data";
import { buildReportPayload, type FootballAIReport } from "@/lib/football-match-report";

export type AIReportState = {
  report: (FootballAIReport & { source?: string }) | null;
  isLoading: boolean;
  error: string | null;
};

// Cache client (évite de re-POSTer à chaque ouverture du dialog).
const reportCache = new Map<string, FootballAIReport & { source?: string }>();

/**
 * Hook — rapport de match IA (Phase 2). Fetch paresseux : POST vers
 * /api/ai/football-match-report uniquement quand `enabled` est vrai (dialog ouvert).
 * Le serveur met en cache 12h ; le client déduplique en mémoire.
 */
export function useFootballAIReport(match: FootballMatch | null, enabled: boolean): AIReportState {
  const [state, setState] = useState<AIReportState>({ report: null, isLoading: false, error: null });

  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!enabled || !match) return;
    const id = match.id;

    const cached = reportCache.get(id);
    if (cached) {
      setState({ report: cached, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ report: null, isLoading: true, error: null });

    fetch("/api/ai/football-match-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, matchData: buildReportPayload(match) }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        return json as FootballAIReport & { source?: string };
      })
      .then((report) => {
        if (cancelled) return;
        reportCache.set(id, report);
        setState({ report, isLoading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ report: null, isLoading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, match, matchId]);

  return state;
}
