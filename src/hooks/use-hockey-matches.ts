import { useState, useEffect, useCallback } from "react";
import type { FootballMatch } from "@/lib/football-data";

type HockeyMatch = {
  id: string;
  league: string;
  leagueId?: number | null;
  leagueCountry?: string | null;
  leagueLogo?: string | null;
  kickoff: string;
  home: {
    teamId: string;
    teamName: string;
    shortName: string;
    logo: string;
  };
  away: {
    teamId: string;
    teamName: string;
    shortName: string;
    logo: string;
  };
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
  h2hUrl?: string;
  date: string;
  sport: "hockey";
};

type HockeyResponse = {
  matches: HockeyMatch[];
  source: string;
  degraded: boolean;
  updatedAt: string;
};

const POLL_INTERVAL_MS = 60_000;

/** Hook principal — calqué sur useFootballMatches mais source Annabet. */
export function useHockeyMatches() {
  const [data, setData] = useState<HockeyResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const fetchMatches = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/hockey/matches");
      if (!res.ok) throw new Error(`API hockey HTTP ${res.status}`);
      const json: HockeyResponse = await res.json();

      // Si BSD/vide → dégradé mais pas d'erreur : on laisse l'onglet afficher
      // le bandeau « source limitée » + état vide plutôt que casser.
      if ((json.matches ?? []).length === 0 && !json.degraded) {
        throw new Error("API hockey vide");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("API hockey indisponible"));
      // En mode dégradé, on conserve l'ancienne data si elle existe
      if (data) { /* garde l'ancien état */ }
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