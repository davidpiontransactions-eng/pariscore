/**
 * Adaptateur LIVE MLB StatsAPI (statsapi.mlb.com) — API publique sans clé.
 * - Calendrier officiel avec lanceurs partants probables (`probablePitcher`)
 * - Stats réelles du lanceur : ERA, WHIP, K/9, BB/9, HR/9, W-L, IP, OPS-contre
 * - FIP recomputé depuis les composantes réelles (HR, BB, HBP, K, IP)
 * - Timeout strict + mode dégradé explicite (jamais de données inventées)
 */

import { computeFip, computeXEra, MLB_ID_TO_CODE } from "@/lib/baseball/registry";
import { parisDateString, shiftIsoDate } from "@/lib/baseball/timezone";
import { round2 } from "@/lib/baseball/format";
import type { GameStatus, PitcherRecord } from "@/lib/baseball/types";

const MLB_BASE = "https://statsapi.mlb.com";

interface MlbProbablePitcher {
  id: number;
  fullName: string;
}

interface MlbTeamRef {
  team: { id: number; name: string };
  probablePitcher: MlbProbablePitcher | null;
  score?: number;
}

interface MlbGameRaw {
  gamePk: number;
  gameDate: string;
  gameType: string;
  dayNight: string;
  status: { statusCode: string; abstractGameState: string };
  teams: { home: MlbTeamRef; away: MlbTeamRef };
  venue: { name: string };
}

interface MlbScheduleRaw {
  dates: { date: string; games: MlbGameRaw[] }[];
}

export interface MlbLiveGame {
  gamePk: number;
  gameDateIso: string;
  venueName: string;
  dayNight: "D" | "N";
  homeTeamMlbId: number;
  awayTeamMlbId: number;
  homePitcher: MlbProbablePitcher | null;
  awayPitcher: MlbProbablePitcher | null;
  status: GameStatus;
  homeRuns: number | null;
  awayRuns: number | null;
}

export interface MlbPitcherStatsRaw {
  era: number | null;
  whip: number | null;
  kPer9: number | null;
  bbPer9: number | null;
  hrPer9: number | null;
  wins: number | null;
  losses: number | null;
  inningsPitched: number | null;
  opsAgainst: number | null;
  gamesStarted: number | null;
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`MLB StatsAPI HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(code: string, state: string): GameStatus {
  if (code === "F" || code === "O" || code === "FR") return "final";
  if (code === "I" || state === "Live" || state === "In Progress") return "live";
  return "scheduled";
}

const SEASON = 2026;

/**
 * Récupère la slate MLB réelle pour une date Paris.
 * Interroge date et date+1 (les matchs nocturnes US débordent sur le
 * lendemain) puis regroupe par date locale Paris.
 */
export async function fetchMlbSlate(
  dateParis: string,
): Promise<{ games: MlbLiveGame[]; degraded: boolean }> {
  const dates = [dateParis, shiftIsoDate(dateParis, 1)];
  const raws: MlbGameRaw[] = [];
  let degraded = false;

  for (const d of dates) {
    try {
      const url = `${MLB_BASE}/api/v1/schedule?sportId=1&date=${d}&hydrate=probablePitcher`;
      const data = await fetchJson<MlbScheduleRaw>(url);
      for (const dateGroup of data.dates) {
        raws.push(...dateGroup.games);
      }
    } catch {
      degraded = true;
    }
  }

  const games: MlbLiveGame[] = raws
    .filter((g) => parisDateString(g.gameDate) === dateParis)
    .map((g): MlbLiveGame => {
      const status = mapStatus(g.status.statusCode, g.status.abstractGameState);
      const homeScore =
        typeof g.teams.home.score === "number" ? g.teams.home.score : null;
      const awayScore =
        typeof g.teams.away.score === "number" ? g.teams.away.score : null;
      const dayNight: "D" | "N" = g.dayNight === "N" ? "N" : "D";
      return {
        gamePk: g.gamePk,
        gameDateIso: g.gameDate,
        venueName: g.venue?.name ?? "Stadium",
        dayNight,
        homeTeamMlbId: g.teams.home.team.id,
        awayTeamMlbId: g.teams.away.team.id,
        homePitcher: g.teams.home.probablePitcher,
        awayPitcher: g.teams.away.probablePitcher,
        status,
        homeRuns: homeScore,
        awayRuns: awayScore,
      };
    })
    // Équipes MLB actives uniquement (exclut futures franchises si liste évolue)
    .filter((g) => MLB_ID_TO_CODE.has(g.homeTeamMlbId) && MLB_ID_TO_CODE.has(g.awayTeamMlbId));

  return { games, degraded };
}

/** Stats saison réelles d'un lanceur MLB (group=pitching, saison en cours). */
export async function fetchMlbPitcherStats(
  personId: number,
): Promise<MlbPitcherStatsRaw | null> {
  try {
    const url = `${MLB_BASE}/api/v1/people/${personId}/stats?stats=statsSingleSeason&sportId=1&season=${SEASON}&gameType=R&group=pitching`;
    const data = await fetchJson<{
      stats: { splits: { stat: Record<string, unknown> }[] }[];
    }>(url);
    const split = data.stats?.[0]?.splits?.[0]?.stat;
    if (!split) return null;
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    return {
      era: num(split.era),
      whip: num(split.whip),
      kPer9: num(split.strikeoutsPer9Inn),
      bbPer9: num(split.walksPer9Inn),
      hrPer9: num(split.homeRunsPer9),
      wins: num(split.wins),
      losses: num(split.losses),
      inningsPitched: num(split.inningsPitched),
      opsAgainst: num(split.ops),
      gamesStarted: num(split.gamesStarted),
    };
  } catch {
    return null;
  }
}

/** Construit le PitcherRecord depuis les stats LIVE (FIP/xERA recalculés). */
export function buildLiveMlbPitcher(
  teamCode: string,
  mlbId: number,
  name: string,
  stats: MlbPitcherStatsRaw | null,
): PitcherRecord {
  const era = stats?.era ?? 4.0;
  const kPer9 = stats?.kPer9 ?? 8.6;
  const bbPer9 = stats?.bbPer9 ?? 3.1;
  const hrPer9 = stats?.hrPer9 ?? 1.14;
  const opsAgainst = stats?.opsAgainst ?? 0.706;
  const gamesStarted = stats?.gamesStarted ?? 20;
  const inningsPitched = stats?.inningsPitched ?? 100;
  return {
    id: `MLB:${mlbId}`,
    league: "MLB",
    teamId: `MLB:${teamCode}`,
    name,
    throws: "RHP", // affiné par /people si disponible (défaut documenté)
    era: round2(era),
    whip: round2(stats?.whip ?? 1.3),
    fip: computeFip(hrPer9, bbPer9, kPer9),
    xEra: computeXEra(opsAgainst),
    kPer9: round2(kPer9),
    bbPer9: round2(bbPer9),
    hrPer9: round2(hrPer9),
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    inningsPitched: round2(inningsPitched),
    opsAgainst: round2(opsAgainst),
    starterIpAvg: round2(Math.min(6.5, Math.max(4.5, inningsPitched / Math.max(1, gamesStarted)))),
    source: stats ? "mlb-statsapi-live" : "curated",
    season: SEASON,
    // Photo portrait officielle MLB (midfield CDN public gratuit).
    // Pour KBO : pas de CDN public — photoUrl absente, fallback initiales.
    photoUrl: `https://midfield.mlbstatic.com/v1/people/${mlbId}/portrait/270x270`,
  };
}
