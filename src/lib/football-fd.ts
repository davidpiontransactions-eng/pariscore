import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Classements par championnat depuis football-data.co.uk (CSV résultats +
 * corners home/away) — scrapé par scripts/scrape_footballdata.py →
 * public/data/fd/{slug}.json.
 *
 * Chaque ligue porte N saisons ; chaque saison porte les équipes avec leurs
 * stats par contexte (overall / home / away) : buts moyens, taux Over/Under,
 * BTTS, corners pour/match + taux Over 6.5/7.5/8.5, points et PPM.
 */

export type FdContextStats = {
  gp: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  ppm: number;
  goalsFor: number;
  goalsAgainst: number;
  gfPg: number;
  gaPg: number;
  /** taux % Over X buts */
  o05: number; o15: number; o25: number; o35: number;
  /** taux % Under X buts */
  u15: number; u25: number; u35: number;
  bttsYesPct: number;
  cornersForPg: number;
  /** taux % Over X corners (total du match) */
  c65: number; c75: number; c85: number;
};

export type FdTeamStats = {
  overall: FdContextStats;
  home: FdContextStats;
  away: FdContextStats;
};

export type FdFile = {
  meta: { leagueId: string; source: string };
  seasons: Record<string, { nMatches: number; teams: Record<string, FdTeamStats> }>;
};

const FD_DIR = join(process.cwd(), "public", "data", "fd");

const cache = new Map<string, FdFile | null>();

function readFd(slug: string): FdFile | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: FdFile | null = null;
  try {
    const file = join(FD_DIR, `${slug}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as FdFile;
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

/** Saisons disponibles pour une ligue (la plus récente en premier). */
export function fdSeasons(slug: string): string[] {
  const file = readFd(slug);
  if (!file?.seasons) return [];
  return Object.keys(file.seasons).sort().reverse();
}

/** Marchés de classement servibles depuis les stats football-data. */
export type FdMarketKey =
  | "gfPg"          // buts marqués / match
  | "gaPg"          // buts encaissés / match
  | "o15"           // over 1.5 %
  | "u35"           // under 3.5 %
  | "bttsYesPct"    // les 2 équipes marquent %
  | "cornersOver65" // over 6.5 corners %
  | "cornersOver75" // over 7.5 corners %
  | "cornersForPg"  // corners pour / match
  | "ppm";          // points par match

export const FD_MARKETS: Record<FdMarketKey, { label: string; higherBetter: boolean }> = {
  gfPg: { label: "Buts marqués/match", higherBetter: true },
  gaPg: { label: "Buts encaissés/match", higherBetter: false },
  o15: { label: "Over 1,5 buts", higherBetter: true },
  u35: { label: "Under 3,5 buts", higherBetter: true },
  bttsYesPct: { label: "Les 2 équipes marquent", higherBetter: true },
  cornersOver65: { label: "Over 6,5 corners", higherBetter: true },
  cornersOver75: { label: "Over 7,5 corners", higherBetter: true },
  cornersForPg: { label: "Corners/match", higherBetter: true },
  ppm: { label: "PPM", higherBetter: true },
};

export type FdScope = "overall" | "home" | "away";

export type FdRankRow = { team: string; value: number; gp: number };

/**
 * Classement des équipes d'une ligue pour un marché / contexte / saison,
 * trié selon la sémantique du marché (ex. encaissés : le plus bas = mieux).
 * Retourne null si la ligue ou la saison est indisponible.
 */
export function fdRanking(
  slug: string,
  season: string,
  market: FdMarketKey,
  scope: FdScope = "overall",
): FdRankRow[] | null {
  const file = readFd(slug);
  const seasonData = file?.seasons?.[season];
  if (!seasonData) return null;

  const higherBetter = FD_MARKETS[market]?.higherBetter ?? true;
  const key = market === "cornersOver65" ? "c65" : market === "cornersOver75" ? "c75" : market;

  const rows: FdRankRow[] = [];
  for (const [team, stats] of Object.entries(seasonData.teams)) {
    const ctx = stats[scope] ?? stats.overall;
    const raw = (ctx as unknown as Record<string, number>)[key];
    if (typeof raw !== "number" || ctx.gp === 0) continue;
    rows.push({ team, value: raw, gp: ctx.gp });
  }
  rows.sort((a, b) => (higherBetter ? b.value - a.value : a.value - b.value));
  return rows;
}

/** Stats complètes d'une équipe (3 contextes) pour une saison donnée. */
export function fdTeamStats(
  slug: string,
  season: string,
  team: string,
): FdTeamStats | null {
  const file = readFd(slug);
  return file?.seasons?.[season]?.teams?.[team] ?? null;
}

/** Type pour une ligne de classement complet (toutes colonnes). */
export type FdStandingRow = {
  team: string;
  gp: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  ppg: number;
  gfPg: number;
  gaPg: number;
};

/**
 * Classement complet d'un championnat (toutes colonnes W/D/L/GF/GA/GD/PTS).
 * Utilisé par FootballRankingsEnhanced pour afficher le tableau complet.
 */
export function fdStandings(
  slug: string,
  season: string,
  scope: FdScope = "overall",
): FdStandingRow[] | null {
  const file = readFd(slug);
  const seasonData = file?.seasons?.[season];
  if (!seasonData) return null;

  const rows: FdStandingRow[] = [];
  for (const [team, stats] of Object.entries(seasonData.teams)) {
    const ctx = stats[scope] ?? stats.overall;
    if (ctx.gp === 0) continue;
    rows.push({
      team,
      gp: ctx.gp,
      wins: ctx.wins,
      draws: ctx.draws,
      losses: ctx.losses,
      points: ctx.points,
      gf: ctx.goalsFor,
      ga: ctx.goalsAgainst,
      gd: ctx.goalsFor - ctx.goalsAgainst,
      ppg: ctx.ppm,
      gfPg: ctx.gfPg,
      gaPg: ctx.gaPg,
    });
  }
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  return rows;
}
