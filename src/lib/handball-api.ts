// Service API-Sports Handball — même clé que football (api-sports.io)

import type { HandballMatch, HandballMatchStatus, HandballScore, HandballLeague, HandballTeam } from "./handball-data";

const HANDBALL_BASE = "https://v3.handball.api-sports.io";
const FIXTURES_TTL_MS = 5 * 60_000;
const LIVE_TTL_MS = 30_000;

interface AfHandballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed?: number };
  };
  league: {
    id: number;
    name: string;
    country: string;
    flag?: string;
    season?: string;
    logo?: string;
  };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
  score?: {
    halftime?: { home: number | null; away: number | null };
  };
}

const STATUS_MAP: Record<string, HandballMatchStatus> = {
  NS: "not_started",
  "1H": "live",
  HT: "halftime",
  "2H": "live",
  FT: "finished",
  POSTP: "postponed",
  CANC: "cancelled",
  SUSP: "live",
  INT: "live",
  PST: "postponed",
  ABD: "cancelled",
  AET: "finished",
  PEN: "finished",
};

function mapStatus(short: string): HandballMatchStatus {
  return STATUS_MAP[short] ?? "not_started";
}

function mapMatch(f: AfHandballFixture): HandballMatch {
  const status = mapStatus(f.fixture.status.short);
  const league: HandballLeague = {
    id: f.league.id,
    name: f.league.name,
    country: f.league.country,
    countryCode: f.league.flag ?? "",
    logo: f.league.logo,
    season: f.league.season,
  };
  const home: HandballTeam = {
    id: f.teams.home.id,
    name: f.teams.home.name,
    logo: f.teams.home.logo,
  };
  const away: HandballTeam = {
    id: f.teams.away.id,
    name: f.teams.away.name,
    logo: f.teams.away.logo,
  };
  const match: HandballMatch = {
    id: f.fixture.id,
    league,
    home,
    away,
    kickoff: f.fixture.date,
    status,
  };
  if (f.goals.home != null || f.goals.away != null) {
    const score: HandballScore = {
      home: f.goals.home ?? 0,
      away: f.goals.away ?? 0,
    };
    if (f.score?.halftime?.home != null || f.score?.halftime?.away != null) {
      score.homeHalf = f.score.halftime.home ?? 0;
      score.awayHalf = f.score.halftime.away ?? 0;
    }
    match.score = score;
  }
  if (f.fixture.status.elapsed) {
    match.minute = f.fixture.status.elapsed;
  }
  return match;
}

async function hbFetch(path: string): Promise<HandballMatch[] | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${HANDBALL_BASE}${path}`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429 || !res.ok) return null;
    const json: unknown = await res.json();
    const response = (json as { response?: unknown })?.response;
    if (!Array.isArray(response)) return [];
    return (response as AfHandballFixture[]).map(mapMatch);
  } catch {
    return null;
  }
}

const __hbFixturesCache = new Map<string, { at: number; data: HandballMatch[] }>();
const __hbLiveCache = new Map<string, { at: number; data: HandballMatch[] }>();

function mapCache<T>(
  store: Map<string, { at: number; data: T }>,
  key: string,
  ttlMs: number,
): T | null {
  const entry = store.get(key);
  if (entry && Date.now() - entry.at < ttlMs) return entry.data;
  return null;
}

function setCache<T>(store: Map<string, { at: number; data: T }>, key: string, data: T) {
  store.set(key, { at: Date.now(), data });
}

export async function fetchHandballFixtures(date?: string): Promise<HandballMatch[]> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const cached = mapCache(__hbFixturesCache, d, FIXTURES_TTL_MS);
  if (cached) return cached;
  const data = await hbFetch(`/fixtures?date=${d}`);
  if (data) {
    setCache(__hbFixturesCache, d, data);
    return data;
  }
  // API-Sports indisponible → pas de données
  return [];
}

export async function fetchHandballLive(): Promise<HandballMatch[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cached = mapCache(__hbLiveCache, today, LIVE_TTL_MS);
  if (cached) return cached;
  const data = await hbFetch(`/fixtures?live=all`);
  if (data) {
    setCache(__hbLiveCache, today, data);
    return data;
  }
  return [];
}

// fetchHandballStandings supprimé (fix audit 2026-09-23) : seul consummer =
// route standings, elle-même non montée + contrat cassé (row.ppg crash) +
// fallback API-Sports handball = 403 (abonnement séparé requis).
