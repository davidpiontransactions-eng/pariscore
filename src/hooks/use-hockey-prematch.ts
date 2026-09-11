"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type StatBlock = {
  oneXtwo?: {
    homeWins: number;
    draws: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  oneTwo?: {
    homeWins: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  totalGoals?: { line: number; underPct: number; overPct: number };
  goalsFor?: { goals: number; pct: number }[];
  goalsAgainst?: { goals: number; pct: number }[];
  btts?: number;
  goalDiff?: { diff: number; pct: number }[];
  goalAverage?: { home: number; away: number; total: number };
};

export type Standing = {
  rank: number;
  name: string;
  gp: number;
  all: { w: number; otw: number; otl: number; l: number; pts: number };
  home: { w: number; otw: number; otl: number; l: number; pts: number };
  away: { w: number; otw: number; otl: number; l: number; pts: number };
  highlighted: boolean;
};

export type MatchPrematch = {
  team1Id: number;
  team1Name: string;
  team2Id: number;
  team2Name: string;
  odds1X2?: { home: number; draw: number; away: number } | null;
  h2h?: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    summaryHome: StatBlock | null;
    summaryAway: StatBlock | null;
    h2hStats: StatBlock | null;
    standings: Standing[];
  } | null;
  summary?: { overUnderLines: { line: number; underPct: number; overPct: number; underOdds: number; overOdds: number }[] } | null;
  error?: string;
};

type PrematchPayload = {
  updatedAt: string;
  source: string;
  leagues: Record<string, { matches: MatchPrematch[]; error?: string }>;
};

export function useHockeyPrematch() {
  const { data, error, isLoading } = useSWR<PrematchPayload>(
    "/api/hockey/prematch",
    fetcher,
    { refreshInterval: 30 * 60 * 1000 } // 30min
  );

  return {
    prematch: data ?? null,
    loading: isLoading,
    error: error ? "Failed to load prematch data" : null,
  };
}
