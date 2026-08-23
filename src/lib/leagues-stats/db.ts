// Lecture des stats de ligues (scrapées d'OddAlerts) depuis pariscore.db.
//
// La table `league_season_stats` est peuplée par scripts/scrape-oddalerts.js
// (cron PM2 `pariscore-cron-oddalerts`, quotidien 04:30 UTC sur le VPS).
// On ouvre la base en lecture seule (readonly) — même pattern que
// src/lib/tennis-stats/db.ts — pour ne jamais concurrencer les writers.
//
// Défensif : si la base est absente (dev local sans données), les fonctions
// retournent null / [] et l'UI dégrade gracieusement.

import path from "node:path";
import type {
  CountryGroup,
  LeagueDetail,
  LeagueFixture,
  LeagueIndexEntry,
  SeasonOption,
  StatsSection,
} from "./types";

type BSD = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[]; get: (...params: unknown[]) => unknown };
  close: () => void;
};

const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

let _db: BSD | null = null;
let _dbUnavailable = false;

function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // better-sqlite3 est un module natif CJS (serverExternalPackages) —
    // require dynamique pour ne pas le charger côté client.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as unknown as {
      new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): BSD;
    };
    _db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
    return _db;
  } catch (err) {
    _dbUnavailable = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[leagues-stats] pariscore.db non lisible (${SQLITE_FILE}) — ` +
          `stats ligues désactivées. Détail: ${(err as Error).message}`
      );
    }
    return null;
  }
}

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToDetail(row: Record<string, unknown>): LeagueDetail {
  return {
    id: String(row.id),
    country: String(row.country),
    slug: String(row.slug),
    name: String(row.leagueName),
    logoUrl: (row.logoUrl as string) || null,
    sport: String(row.sport || "football"),
    seasonLabel: (row.seasonLabel as string) || null,
    seasons: parseJsonSafe<SeasonOption[]>(row.seasonsJson as string, []),
    gamesPlayed: Number(row.gamesPlayed || 0),
    sections: parseJsonSafe<StatsSection[]>(row.statsJson as string, []),
    fixtures: parseJsonSafe<LeagueFixture[]>(row.fixturesJson as string, []),
    sourceUrl: (row.sourceUrl as string) || null,
    updatedAt: String(row.updatedAt || ""),
  };
}

/**
 * Index complet des ligues disponibles (toutes confondues), trié par pays puis nom.
 */
export function listLeagues(): LeagueIndexEntry[] {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT id, country, slug, leagueName, logoUrl, seasonLabel, gamesPlayed, updatedAt
       FROM league_season_stats
       ORDER BY country ASC, leagueName ASC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    country: String(row.country),
    slug: String(row.slug),
    name: String(row.leagueName),
    logoUrl: (row.logoUrl as string) || null,
    seasonLabel: (row.seasonLabel as string) || null,
    gamesPlayed: Number(row.gamesPlayed || 0),
    updatedAt: String(row.updatedAt || ""),
  }));
}

/**
 * Comptage par pays (pour les filtres de la page index).
 */
export function countByCountry(): CountryGroup[] {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT country, COUNT(*) AS count
       FROM league_season_stats
       GROUP BY country
       ORDER BY country ASC`
    )
    .all() as { country: string; count: number }[];
  return rows.map((r) => ({ country: r.country, count: Number(r.count) }));
}

/**
 * Détail d'une ligue par couple (country, slug). Retourne null si absente.
 */
export function getLeague(country: string, slug: string): LeagueDetail | null {
  const db = getDb();
  if (!db) return null;
  const row = db
    .prepare(`SELECT * FROM league_season_stats WHERE country = ? AND slug = ? LIMIT 1`)
    .get(country, slug) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToDetail(row);
}
