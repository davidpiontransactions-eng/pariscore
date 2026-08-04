"use client";

import { useState, useEffect, useCallback } from "react";
import type { FootballMatch } from "@/lib/football-data";
import { ALL_FOOTBALL_MATCHES } from "@/lib/football-data";

type FootballResponse = {
  matches: FootballMatch[];
  source: string;
  updatedAt: string;
};

const MOCK_DELAY_MS = 300;
const POLL_INTERVAL_MS = 60_000;

// Transform API v2 (Prisma) → FootballMatch
function transformV2(m: any): FootballMatch {
  return {
    id: m.id,
    league: m.league ?? { id: "?", name: "?", country: "?", logo: "🌐", tier: "T2" },
    round: m.round ?? "?",
    scheduledAt: m.scheduledAt,
    home: { id: m.home.id, name: m.home.name, shortName: m.home.shortName, logo: m.home.logo ?? "", color: m.home.color ?? "#666", form: [], rank: 99 },
    away: { id: m.away.id, name: m.away.name, shortName: m.away.shortName, logo: m.away.logo ?? "", color: m.away.color ?? "#666", form: [], rank: 99 },
    prediction: m.prediction ?? { homeProb: 50, drawProb: 25, awayProb: 25, bttsProb: 50, over25Prob: 50, model: "default" },
    odds: m.odds?.[0] ? { bookmaker: m.odds[0].bookmaker, home: m.odds[0].home, draw: m.odds[0].draw ?? 3.5, away: m.odds[0].away } : undefined,
    allOdds: m.odds?.map((o: any) => ({ bookmaker: o.bookmaker, home: o.home, draw: o.draw ?? 3.5, away: o.away, impliedHome: 33, impliedDraw: 33, impliedAway: 33, margin: 0.03 })),
    live: m.status === "live" ? { homeScore: m.liveHomeScore ?? 0, awayScore: m.liveAwayScore ?? 0, minute: m.liveMinute ?? 0, status: m.liveStatus ?? "LIVE", homePossession: 50, homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeCorners: 0, awayCorners: 0 } : null,
  };
}

export function useFootballMatches() {
  const [data, setData] = useState<FootballResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const fetchMatches = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      // Primaire: API v2 Prisma
      const res = await fetch("/api/v2/matches?sport=football&limit=100");
      if (res.ok) {
        const json = await res.json();
        const transformed = (json.matches ?? []).map(transformV2);
        if (transformed.length > 0) {
          setData({ matches: transformed, source: "prisma-v2", updatedAt: new Date().toISOString() });
          setIsLoading(false);
          setIsValidating(false);
          return;
        }
      }
      // Fallback: API legacy v1
      const legacyRes = await fetch("/api/football/matches");
      if (legacyRes.ok) {
        const json: FootballResponse = await legacyRes.json();
        setData(json);
        setIsLoading(false);
        setIsValidating(false);
        return;
      }
      throw new Error("API v2 et legacy indisponibles");
    } catch {
      // Mock fallback
      await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
      setData({
        matches: ALL_FOOTBALL_MATCHES,
        source: "mock",
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { data, error, isLoading, isValidating, mutate: fetchMatches };
}
