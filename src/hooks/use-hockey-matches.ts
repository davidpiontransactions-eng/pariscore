import { useState, useEffect, useCallback } from "react";

/** Match hockey normalisé depuis /api/hockey/matches. */
export type HockeyMatch = {
  id: string;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  isLive: boolean;
  leagueId: string;
  leagueName: string;
  countryName: string;
  countryCode: string;
  oddsH: number | null;
  oddsD: number | null;
  oddsA: number | null;
  h2h?: unknown;
  source: string;
};

type HockeyResponse = {
  matches: HockeyMatch[];
  source: string;
  degraded: boolean;
};

const POLL_INTERVAL_MS = 60_000;

/** Hook hockey — fetch /api/hockey/matches (Annabet + SkipOdds + BSD). */
export function useHockeyMatches() {
  const [data, setData] = useState<HockeyResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/hockey/matches");
      if (!res.ok) throw new Error(`API hockey HTTP ${res.status}`);
      const json: HockeyResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("API hockey indisponible"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { data, error, isLoading, mutate: fetchMatches };
}
