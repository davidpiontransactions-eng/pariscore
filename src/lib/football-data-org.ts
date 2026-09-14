/**
 * football-data-org.ts — Connecteur football-data.org API (standings home/away).
 *
 * API gratuite : 10 req/min, 500 req/jour (1000+ avec auth header).
 * Couvre 40+ championnats : Eredivisie, Primeira Liga, Championship, 2. Bundesliga, etc.
 * Fournit standings TOTAL/HOME/AWAY avec W/D/L, GF/GA, points, form.
 *
 * Docs: https://www.football-data.org/documentation/api
 */

import type { FootballMatch, LeagueStandings } from "./football-data";

// ── Types API ──────────────────────────────────────────────────────────────

interface FbOrgTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface FbOrgStandingRow {
  position: number;
  team: FbOrgTeam;
  playedGames: number;
  form?: string;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FbOrgStanding {
  stage: string;
  type: "TOTAL" | "HOME" | "AWAY";
  group: string | null;
  table: FbOrgStandingRow[];
}

interface FbOrgCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem?: string;
}

interface FbOrgSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  winner: string | null;
  stages: string[];
}

interface FbOrgStandingsResponse {
  filters: Record<string, unknown>;
  area: { id: number; name: string; code: string; flag: string };
  competition: FbOrgCompetition;
  season: FbOrgSeason;
  standings: FbOrgStanding[];
}

// ── Mapping ligues ParisScore → football-data.org codes ────────────────────

const LEAGUE_CODE_MAP: Record<string, string> = {
  // Big 5 (déjà couverts par BSD/FBref)
  england: "PL",
  spain: "PD",
  germany: "BL1",
  italy: "SA",
  france: "FL1",

  // Championnats supplémentaires
  netherlands: "DED",      // Eredivisie
  portugal: "PPL",         // Primeira Liga
  england2: "ELC",         // Championship
  germany2: "BL2",         // 2. Bundesliga
  italy2: "SB",            // Serie B
  spain2: "SD",            // Segunda División
  france2: "FL2",          // Ligue 2
  belgium: "BEL",          // Jupiler Pro League
  turkey: "TUR",           // Süper Lig
  greece: "GSL",           // Super League Greece
  scotland: "SCO",         // Premiership
  denmark: "DEN",          // Superliga
  austria: "AUT",          // Admiral Bundesliga
  switzerland: "SUI",      // Super League
  poland: "POL",           // Ekstraklasa
  ukraine: "UKR",          // Premier League Ukraine
  russia: "RUS",           // Premier League Russia
  czech: "CZE",            // First League
  romania: "ROU",          // Liga I
  norway: "NOR",           // Eliteserien
  sweden: "SWE",           // Allsvenskan
  israel: "ISR",           // Ligat HaAl
  croatia: "CRO",          // HNL
  serbia: "SRB",           // SuperLiga
  hungary: "HUN",          // NB I
  bulgaria: "BUL",         // First League
  finland: "FIN",          // Veikkausliiga
  mls: "MLS",              // Major League Soccer
  brazil: "BSA",           // Brasileirão
  argentina: "ARG",        // Liga Profesional
  mexico: "MX",            // Liga MX
  usa: "MLS",
  japan: "JPN",            // J1 League
  korea: "KOR",            // K League 1
  australia: "AUS",        // A-League
  saudi: "SAU",            // Saudi Pro League
  qatar: "QAT",            // Qatar Stars League
  uae: "UAE",              // UAE Pro League
};

// ── Cache ──────────────────────────────────────────────────────────────────

const standingsCache = new Map<string, { data: FbOrgStanding[]; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// ── Helpers ────────────────────────────────────────────────────────────────

function getApiKey(): string {
  return process.env.FOOTBALL_DATA_API_KEY ?? "";
}

function cacheKey(leagueCode: string, season?: string): string {
  return `${leagueCode}:${season ?? "current"}`;
}

function isCacheValid(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL_MS;
}

// ── Fetch principal ────────────────────────────────────────────────────────

async function fetchStandings(
  leagueCode: string,
  season?: string,
): Promise<FbOrgStanding[] | null> {
  const key = cacheKey(leagueCode, season);
  const cached = standingsCache.get(key);
  if (cached && isCacheValid(cached.ts)) return cached.data;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[football-data-org] FOOTBALL_DATA_API_KEY manquant");
    return null;
  }

  const url = new URL(
    `https://api.football-data.org/v4/competitions/${leagueCode}/standings`,
  );
  if (season) url.searchParams.set("season", season);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Auth-Token": apiKey },
      // Next.js cache
      next: { revalidate: 21600 }, // 6h
    });

    if (!res.ok) {
      if (res.status === 429) console.warn("[football-data-org] Rate limit");
      else if (res.status === 403) console.warn("[football-data-org] Forbidden - check API key");
      else if (res.status === 404) console.warn(`[football-data-org] League ${leagueCode} not found`);
      return null;
    }

    const data = (await res.json()) as FbOrgStandingsResponse;
    const standings = data.standings ?? [];

    standingsCache.set(key, { data: standings, ts: Date.now() });
    return standings;
  } catch (e) {
    console.error("[football-data-org] Fetch error:", e);
    return null;
  }
}

// ── Conversion vers format ParisScore ──────────────────────────────────────

function toStandingContext(
  rows: FbOrgStandingRow[],
  type: "home" | "away" | "total",
): LeagueStandings {
  return rows.map((r) => ({
    played: r.playedGames,
    points: r.points,
    ppg: r.playedGames > 0 ? +(r.points / r.playedGames).toFixed(2) : 0,
    wins: r.won,
    draws: r.draw,
    losses: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDiff: r.goalDifference,
    rank: r.position,
    rankTotal: rows.length,
    partial: false,
  }));
}

function extractStandings(
  standings: FbOrgStanding[],
): { home: LeagueStandings; away: LeagueStandings; total: LeagueStandings } {
  const home = standings.find((s) => s.type === "HOME")?.table ?? [];
  const away = standings.find((s) => s.type === "AWAY")?.table ?? [];
  const total = standings.find((s) => s.type === "TOTAL")?.table ?? [];

  return {
    home: toStandingContext(home, "home"),
    away: toStandingContext(away, "away"),
    total: toStandingContext(total, "total"),
  };
}

// ── API publique ───────────────────────────────────────────────────────────

/**
 * Récupère les standings home/away/total pour une ligue ParisScore.
 * @param leagueSlug — slug ParisScore (ex: "netherlands", "portugal", "england2")
 * @param season — saison optionnelle (ex: "2025")
 * @returns { home, away, total } LeagueStandings ou null si erreur
 */
export async function getFbOrgStandings(
  leagueSlug: string,
  season?: string,
): Promise<{ home: LeagueStandings; away: LeagueStandings; total: LeagueStandings } | null> {
  const leagueCode = LEAGUE_CODE_MAP[leagueSlug];
  if (!leagueCode) {
    console.warn(`[football-data-org] Ligue inconnue: ${leagueSlug}`);
    return null;
  }

  const standings = await fetchStandings(leagueCode, season);
  if (!standings || standings.length === 0) return null;

  return extractStandings(standings);
}

/**
 * Version synchrone pour compatibilité — lit le cache uniquement.
 */
export function getFbOrgStandingsSync(
  leagueSlug: string,
  season?: string,
): { home: LeagueStandings; away: LeagueStandings; total: LeagueStandings } | null {
  const leagueCode = LEAGUE_CODE_MAP[leagueSlug];
  if (!leagueCode) return null;

  const key = cacheKey(leagueCode, season);
  const cached = standingsCache.get(key);
  if (!cached) return null;

  return extractStandings(cached.data);
}

/**
 * Préchauffe le cache pour plusieurs ligues.
 */
export async function warmFbOrgStandingsCache(
  leagueSlugs: string[],
  season?: string,
): Promise<void> {
  await Promise.all(
    leagueSlugs.map((slug) => getFbOrgStandings(slug, season)),
  );
}

// ── Export des codes ligues pour debug ─────────────────────────────────────

export { LEAGUE_CODE_MAP };