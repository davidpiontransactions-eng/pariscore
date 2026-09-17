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
  // Fallback mock si API inaccessible — données de démonstration
  const mock = generateMockFixtures();
  setCache(__hbFixturesCache, d, mock);
  return mock;
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

// ─── Mock fixtures pour démonstration quand API-Sports indisponible ───

function generateMockFixtures(): HandballMatch[] {
  const now = Date.now();
  const leagues = [
    { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
    { id: 2, name: "Bundesliga", country: "Germany", countryCode: "DE" },
    { id: 3, name: "Liga ASOBAL", country: "Spain", countryCode: "ES" },
    { id: 4, name: "EHF Champions League", country: "Europe", countryCode: "EU" },
  ];
  const teams: Record<number, { id: number; name: string; shortName: string }[]> = {
    1: [
      { id: 101, name: "Paris Saint-Germain HB", shortName: "PSG" },
      { id: 102, name: "HBC Nantes", shortName: "Nantes" },
      { id: 103, name: "Montpellier HB", shortName: "Montpellier" },
      { id: 104, name: "Toulouse HB", shortName: "Toulouse" },
      { id: 105, name: "Chambéry SMB", shortName: "Chambéry" },
      { id: 106, name: "US Créteil", shortName: "Créteil" },
    ],
    2: [
      { id: 201, name: "THW Kiel", shortName: "Kiel" },
      { id: 202, name: "SG Flensburg-Handewitt", shortName: "Flensburg" },
      { id: 203, name: "SC Magdeburg", shortName: "Magdeburg" },
      { id: 204, name: "Füchse Berlin", shortName: "Berlin" },
    ],
    3: [
      { id: 301, name: "FC Barcelona", shortName: "Barça" },
      { id: 302, name: "Ademar León", shortName: "Ademar" },
      { id: 303, name: "Bidasoa Irun", shortName: "Bidasoa" },
    ],
    4: [
      { id: 401, name: "KC Veszprém", shortName: "Veszprém" },
      { id: 402, name: "RK Vardar", shortName: "Vardar" },
      { id: 403, name: "Barça", shortName: "Barça" },
      { id: 404, name: "THW Kiel", shortName: "Kiel" },
    ],
  };

  const matches: HandballMatch[] = [];
  let id = 9000;
  // Heures de match réalistes en France : 18h, 19h, 20h, 21h (UTC+2 été)
  // En UTC : 16h, 17h, 18h, 19h
  const matchHoursUtc = [16, 17, 18, 19];
  let matchIdx = 0;

  // Matchs terminés récents (forme des équipes) — 5 derniers par ligue
  const finishedResults: Record<number, { homeId: number; awayId: number; hg: number; ag: number }[]> = {
    1: [
      { homeId: 101, awayId: 103, hg: 32, ag: 26 },
      { homeId: 102, awayId: 105, hg: 28, ag: 27 },
      { homeId: 103, awayId: 104, hg: 30, ag: 24 },
      { homeId: 105, awayId: 101, hg: 22, ag: 35 },
      { homeId: 106, awayId: 102, hg: 25, ag: 29 },
    ],
    2: [
      { homeId: 201, awayId: 203, hg: 34, ag: 28 },
      { homeId: 202, awayId: 204, hg: 29, ag: 30 },
      { homeId: 203, awayId: 201, hg: 27, ag: 31 },
      { homeId: 204, awayId: 202, hg: 33, ag: 26 },
      { homeId: 201, awayId: 204, hg: 35, ag: 25 },
    ],
    3: [
      { homeId: 301, awayId: 302, hg: 38, ag: 22 },
      { homeId: 302, awayId: 303, hg: 27, ag: 26 },
      { homeId: 303, awayId: 301, hg: 20, ag: 36 },
      { homeId: 301, awayId: 303, hg: 40, ag: 19 },
      { homeId: 302, awayId: 301, hg: 24, ag: 33 },
    ],
    4: [
      { homeId: 401, awayId: 402, hg: 30, ag: 28 },
      { homeId: 403, awayId: 404, hg: 33, ag: 29 },
      { homeId: 402, awayId: 403, hg: 25, ag: 34 },
      { homeId: 404, awayId: 401, hg: 31, ag: 27 },
      { homeId: 401, awayId: 403, hg: 29, ag: 32 },
    ],
  };

  // Générer matchs terminés (dates passées)
  for (const league of leagues) {
    const results = finishedResults[league.id] ?? [];
    for (const r of results) {
      const home = (teams[league.id] ?? []).find(t => t.id === r.homeId);
      const away = (teams[league.id] ?? []).find(t => t.id === r.awayId);
      if (!home || !away) continue;
      const kickoff = new Date(now - (id - 8990) * 86400_000).toISOString();
      matches.push({
        id: id++,
        league,
        home: { id: home.id, name: home.name, shortName: home.shortName },
        away: { id: away.id, name: away.name, shortName: away.shortName },
        kickoff,
        status: "finished",
        score: {
          home: r.hg,
          away: r.ag,
          homeHalf: Math.floor(r.hg * 0.45),
          awayHalf: Math.floor(r.ag * 0.45),
        },
      });
    }
  }

  // Matchs à venir
  for (const league of leagues) {
    const leagueTeams = teams[league.id] ?? [];
    for (let i = 0; i < leagueTeams.length - 1; i += 2) {
      const home = leagueTeams[i];
      const away = leagueTeams[i + 1];
      // Créer une date aujourd'hui à l'heure de match
      const matchDate = new Date(now);
      matchDate.setUTCHours(matchHoursUtc[matchIdx % matchHoursUtc.length], 0, 0, 0);
      // Si l'heure est déjà passée, mettre demain
      if (matchDate.getTime() < now) {
        matchDate.setUTCDate(matchDate.getUTCDate() + 1);
      }
      const kickoff = matchDate.toISOString();
      matchIdx++;
      const homeGoals = 25 + Math.floor(Math.random() * 10);
      const awayGoals = 22 + Math.floor(Math.random() * 10);

      matches.push({
        id: id++,
        league,
        home: { id: home.id, name: home.name, shortName: home.shortName },
        away: { id: away.id, name: away.name, shortName: away.shortName },
        kickoff,
        status: "not_started",
        odds: {
          home: 1.4 + Math.random() * 1.5,
          draw: 7 + Math.random() * 5,
          away: 2 + Math.random() * 2,
        },
      });
    }
  }

  return matches;
}

export async function fetchHandballStandings(leagueId: number): Promise<unknown> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  try {
    const season = new Date().getFullYear();
    const res = await fetch(`${HANDBALL_BASE}/standings?league=${leagueId}&season=${season}`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return (json as { response?: unknown })?.response ?? null;
  } catch {
    return null;
  }
}
