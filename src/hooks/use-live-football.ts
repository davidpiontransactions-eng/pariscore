"use client";

import useSWR from "swr";
import type { FootballMatch, Team, League, Prediction, FootballMatchOdds, FootballLiveState } from "@/lib/football-data";

// ─── Types API v2 (Prisma) ──────────────────────────────────────────────────

type ApiV2Match = {
  id: string;
  sport: string;
  round: string | null;
  scheduledAt: string;
  status: string;
  liveMinute: number | null;
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  liveStatus: string | null;
  home: { id: string; name: string; shortName: string; logo: string | null; color: string | null };
  away: { id: string; name: string; shortName: string; logo: string | null; color: string | null };
  league: { id: string; name: string; country: string; countryCode: string | null; logo: string | null } | null;
  prediction: {
    homeProb: number; drawProb: number | null; awayProb: number;
    bttsProb: number | null; over25Prob: number | null;
    over15Prob: number | null; under35Prob: number | null;
    model: string; edge: number; confidence: number;
  } | null;
  odds: { bookmaker: string; home: number; draw: number | null; away: number; movement: string | null }[];
};

type ApiV2Response = { matches: ApiV2Match[]; total: number };

// ─── Fetcher ────────────────────────────────────────────────────────────────

const fetcher = (url: string): Promise<ApiV2Response> =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

// ─── Transform Prisma → FootballMatch ───────────────────────────────────────

const DEFAULT_LEAGUE: League = { id: "unknown", name: "Inconnu", country: "??", countryCode: "??", logo: "🌐", tier: "T2" };
const DEFAULT_TEAM = (id: string, name: string, shortName: string): Team => ({
  id, name, shortName,
  logo: "", color: "#666",
  form: [], rank: 99,
});

function transformMatch(m: ApiV2Match): FootballMatch {
  const league: League = m.league
    ? { id: m.league.id, name: m.league.name, country: m.league.country, countryCode: m.league.countryCode ?? m.league.country ?? "??", logo: m.league.logo ?? "🌐", tier: "T1" }
    : DEFAULT_LEAGUE;

  const home: Team = {
    ...DEFAULT_TEAM(m.home.id, m.home.name, m.home.shortName),
    logo: m.home.logo ?? "",
    color: m.home.color ?? "#666",
  };
  const away: Team = {
    ...DEFAULT_TEAM(m.away.id, m.away.name, m.away.shortName),
    logo: m.away.logo ?? "",
    color: m.away.color ?? "#666",
  };

  const prediction: Prediction = m.prediction
    ? {
        homeProb: m.prediction.homeProb,
        drawProb: m.prediction.drawProb ?? 25,
        awayProb: m.prediction.awayProb,
        bttsProb: m.prediction.bttsProb ?? 50,
        over25Prob: m.prediction.over25Prob ?? 50,
        model: m.prediction.model,
        doubleChance: undefined,
        over15Prob: m.prediction.over15Prob ?? undefined,
        under35Prob: m.prediction.under35Prob ?? undefined,
      }
    : { homeProb: 50, drawProb: 25, awayProb: 25, bttsProb: 50, over25Prob: 50, model: "default" };

  const liveStatus = m.liveStatus && ["LIVE", "HT", "FT", "PEN"].includes(m.liveStatus)
    ? (m.liveStatus as FootballLiveState["status"])
    : "LIVE";
  const live: FootballLiveState | null = m.status === "live" && m.liveMinute != null
    ? {
        homeScore: m.liveHomeScore ?? 0,
        awayScore: m.liveAwayScore ?? 0,
        minute: m.liveMinute,
        status: liveStatus,
        homePossession: 50,
        homeShots: 0, awayShots: 0,
        homeShotsOnTarget: 0, awayShotsOnTarget: 0,
        homeCorners: 0, awayCorners: 0,
      }
    : null;

  const allOdds: FootballMatchOdds[] = m.odds.map((o) => ({
    bookmaker: o.bookmaker,
    home: o.home, draw: o.draw ?? 3.5, away: o.away,
    impliedHome: Math.round((1 / o.home) * 100),
    impliedDraw: o.draw ? Math.round((1 / o.draw) * 100) : 25,
    impliedAway: Math.round((1 / o.away) * 100),
    margin: 0.03,
  }));

  const mainOdds = m.odds.length > 0
    ? { bookmaker: m.odds[0].bookmaker, home: m.odds[0].home, draw: m.odds[0].draw ?? 3.5, away: m.odds[0].away }
    : undefined;

  return {
    id: m.id,
    league,
    round: m.round ?? "?",
    scheduledAt: m.scheduledAt,
    home,
    away,
    prediction,
    odds: mainOdds,
    allOdds: allOdds.length > 0 ? allOdds : undefined,
    live,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useLiveFootball() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiV2Response>(
    "/api/v2/matches/live",
    fetcher,
    { refreshInterval: 30_000, dedupingInterval: 15_000, revalidateOnFocus: true },
  );

  const matches: FootballMatch[] = data?.matches?.map(transformMatch) ?? [];

  return { matches, isLoading, isValidating, error, mutate };
}
