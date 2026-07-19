"use client";

import { useState, useEffect, useCallback } from "react";
import type { FootballMatch } from "@/lib/football-data";
import { ALL_FOOTBALL_MATCHES } from "@/lib/football-data";

type FootballResponse = {
  matches: FootballMatch[];
  source: string;
  updatedAt: string;
};

const MOCK_DELAY_MS = 600;

export function useFootballMatches() {
  const [data, setData] = useState<FootballResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const fetchMatches = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/football/matches");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FootballResponse = await res.json();
      setData(json);
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
    const interval = setInterval(fetchMatches, 60_000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { data, error, isLoading, isValidating, mutate: fetchMatches };
}
