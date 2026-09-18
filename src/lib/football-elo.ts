import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Classement Elo foot interne — généré par scripts/compute_football_elo.py
 * (CSV football-data.co.uk, ordre chronologique, base 1500, K=22, HFA +55)
 * dans public/data/elo-football.json. Refresh hebdo via refresh-football-elo.yml.
 */

export type FootballEloEntry = {
  team: string;
  elo: number;
  rank: number;
  matches: number;
};

export type FootballEloLeague = {
  season: string;
  teams: FootballEloEntry[];
};

type EloFile = {
  meta?: Record<string, unknown>;
  leagues: Record<string, FootballEloLeague>;
};

const ELO_PATH = join(process.cwd(), "public", "data", "elo-football.json");

let cache: EloFile | null | undefined;

function readElo(): EloFile | null {
  if (cache !== undefined) return cache;
  try {
    if (!existsSync(ELO_PATH)) {
      cache = null;
      return cache;
    }
    cache = JSON.parse(readFileSync(ELO_PATH, "utf-8")) as EloFile;
  } catch {
    cache = null;
  }
  return cache;
}

/** Normalisation insensible (casse, accents, ponctuation) pour la jointure. */
export function normTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Entrée Elo d'une équipe dans une ligue (+ rang), null si absente. */
export function footballElo(slug: string, team: string): FootballEloEntry | null {
  const file = readElo();
  const league = file?.leagues?.[slug];
  if (!league) return null;
  const key = normTeam(team);
  return league.teams.find((t) => normTeam(t.team) === key) ?? null;
}

/** Nombre d'équipes classées dans la ligue (dénominateur du rang). */
export function footballEloTotal(slug: string): number {
  return readElo()?.leagues?.[slug]?.teams.length ?? 0;
}

/**
 * Elo moyen de la ligue hors une équipe (force de calendrier v1 —
 * approximation documentée : sans historique par adversaire, cf. T10).
 * Null si ligue inconnue.
 */
export function footballEloMean(slug: string, excludeTeam: string): number | null {
  const teams = readElo()?.leagues?.[slug]?.teams;
  if (!teams || teams.length < 2) return null;
  const key = normTeam(excludeTeam);
  const others = teams.filter((t) => normTeam(t.team) !== key);
  if (others.length === 0) return null;
  return Math.round(others.reduce((s, t) => s + t.elo, 0) / others.length);
}
