/**
 * Client EuroLeague/EuroCup — bridge vers euroleague_api (Python) via API route Next.js.
 * euroleague_api fournit PBP, shot data, standings, lineups pour EuroLeague + EuroCup.
 * Zéro dépendance npm — appel HTTP vers /api/euroleague/*.
 */

import type { BasketballLeagueId } from "./basketball-data";

export type EuroLeagueMatch = {
  code: number;
  id: number;
  home: { id: number; name: string; code: string };
  away: { id: number; name: string; code: string };
  status: string;
  startTime: string;
  homeScore: number | null;
  awayScore: number | null;
  round: number;
  group: string | null;
  venue: string | null;
};

export type EuroLeagueStanding = {
  position: number;
  team: { id: number; name: string; code: string };
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  efficiency: number;
  form: string;
};

export type EuroLeagueShot = {
  playerId: number;
  playerName: string;
  teamId: number;
  x: number; // coordonnées shot (0-1 normalisé)
  y: number;
  made: boolean;
  points: number;
  quarter: number;
  time: string;
};

const BASE_URL = "/api/euroleague";
const DEFAULT_TIMEOUT = 15000;

async function fetchJson<T>(url: string, timeout = DEFAULT_TIMEOUT): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Récupère les matchs EuroLeague/EuroCup pour une saison donnée. */
export async function fetchEuroLeagueMatches(
  league: "euroleague" | "eurocup",
  season?: string,
): Promise<EuroLeagueMatch[]> {
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  const qs = params.toString();
  const data = await fetchJson<{ games: EuroLeagueMatch[] }>(
    `${BASE_URL}/matches?league=${league}${qs ? "&" + qs : ""}`,
  );
  return data?.games ?? [];
}

/** Récupère les matchs EuroLeague/EuroCup pour une saison donnée (client-side). */
export function useEuroLeagueMatches(
  league: "euroleague" | "eurocup",
  season?: string,
): { matches: EuroLeagueMatch[]; isLoading: boolean; error: Error | null } {
  // SWR hook — appelé depuis use-euroleague-matches.ts
  return { matches: [], isLoading: false, error: null };
}

/** Récupère les standings EuroLeague/EuroCup. */
export async function fetchEuroLeagueStandings(
  league: "euroleague" | "eurocup",
  season?: string,
): Promise<EuroLeagueStanding[]> {
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  const qs = params.toString();
  const data = await fetchJson<{ standings: EuroLeagueStanding[] }>(
    `${BASE_URL}/standings?league=${league}${qs ? "&" + qs : ""}`,
  );
  return data?.standings ?? [];
}

/** Récupère les shots d'un match EuroLeague (shot chart). */
export async function fetchEuroLeagueShots(
  gameId: number,
): Promise<EuroLeagueShot[]> {
  const data = await fetchJson<{ shots: EuroLeagueShot[] }>(
    `${BASE_URL}/shots?gameId=${gameId}`,
  );
  return data?.shots ?? [];
}

/** Convertit un match EuroLeague en format normalisé pour l'UI. */
export function normalizeEuroLeagueMatch(match: EuroLeagueMatch, league: BasketballLeagueId): {
  id: string;
  league: BasketballLeagueId;
  scheduledAt: string;
  status: string;
  home: { abbr: string; name: string; score: number | null; record: string | null };
  away: { abbr: string; name: string; score: number | null; record: string | null };
} {
  return {
    id: `eu_${match.id}`,
    league,
    scheduledAt: match.startTime,
    status: match.status === "live" ? "in-progress" : match.status === "finished" ? "post" : "pre",
    home: {
      abbr: match.home.code,
      name: match.home.name,
      score: match.homeScore,
      record: null,
    },
    away: {
      abbr: match.away.code,
      name: match.away.name,
      score: match.awayScore,
      record: null,
    },
  };
}
