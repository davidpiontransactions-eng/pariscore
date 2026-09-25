// Lecture readonly de l'historique handball (table `handball_match_history`
// de pariscore.db) — même pattern défensif que src/lib/leagues-stats/db.ts :
// bun:sqlite en priorité (runtime de prod), better-sqlite3 en repli (node),
// base absente → retour vide / null et l'UI dégrade proprement.
//
// La table est peuplée par scripts/scrape-handball-history.mjs
// (cron PM2 `pariscore-cron-handball-history`, hebdomadaire lundi 04:20 UTC).

import path from "node:path";
import type { HistoryMatch } from "./handball-history-stats";

type BSD = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
  close: () => void;
};

const SQLITE_FILE = process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

let _db: BSD | null = null;
let _dbUnavailable = false;

function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as {
      Database: new (file: string, opts?: object) => BSD;
    };
    _db = new Database(SQLITE_FILE, { readonly: true });
    return _db;
  } catch {
    try {
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
          `[handball-history] ${SQLITE_FILE} non lisible — analyse handball désactivée. ` +
            `Détail: ${(err as Error).message}`
        );
      }
      return null;
    }
  }
}

function toMatch(row: Record<string, unknown>): HistoryMatch {
  return {
    date: String(row.date),
    timeUtc: row.time_utc != null ? String(row.time_utc) : null,
    home: String(row.home),
    away: String(row.away),
    homeKey: String(row.home_key),
    awayKey: String(row.away_key),
    homeGoals: Number(row.home_goals),
    awayGoals: Number(row.away_goals),
    homeHalf: row.home_half != null ? Number(row.home_half) : null,
    awayHalf: row.away_half != null ? Number(row.away_half) : null,
    league: row.league != null ? String(row.league) : null,
    country: row.country != null ? String(row.country) : null,
  };
}

/** État de la table (fraîcheur, volume, couverture temporelle). */
export function historyMeta(): {
  n: number;
  minDate: string | null;
  maxDate: string | null;
  lastRun: string | null;
} | null {
  const db = getDb();
  if (!db) return null;
  try {
    const stat = db
      .prepare(`SELECT COUNT(*) AS n, MIN(date) AS minDate, MAX(date) AS maxDate FROM handball_match_history`)
      .get() as Record<string, unknown> | undefined;
    const run = db
      .prepare(`SELECT value FROM handball_history_meta WHERE key = 'last_run'`)
      .get() as Record<string, unknown> | undefined;
    if (!stat) return null;
    return {
      n: Number(stat.n || 0),
      minDate: stat.minDate != null ? String(stat.minDate) : null,
      maxDate: stat.maxDate != null ? String(stat.maxDate) : null,
      lastRun: run?.value != null ? String(run.value) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Matchs d'historique impliquant AU MOINS l'une des deux équipes, côté
 * domicile OU côté extérieur (les 4 combinaisons) — tri date DESC,
 * fenêtre `limit` (L5/L10 + largeur pour les splits Home/Away).
 */
export function loadTeamRows(homeKey: string, awayKey: string, limit = 160): HistoryMatch[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT * FROM handball_match_history
         WHERE home_key IN (?, ?) OR away_key IN (?, ?)
         ORDER BY date DESC
         LIMIT ?`
      )
      .all(homeKey, awayKey, homeKey, awayKey, limit) as Record<string, unknown>[];
    return rows.map(toMatch);
  } catch {
    return [];
  }
}

/** Clés d'équipes présentes (résolution approximative des noms du calendrier). */
export function listTeamKeys(): string[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT home_key AS k FROM handball_match_history
         UNION
         SELECT away_key FROM handball_match_history`
      )
      .all() as Record<string, unknown>[];
    return rows.map((r) => String(r.k));
  } catch {
    return [];
  }
}

/**
 * Totaux récents pour calibrer l'échelle (moyenne observée → base 60 pts).
 * `days` = fenêtre glissante, `limit` = garde-fou mémoire.
 */
export function loadRecentTotals(days = 30, limit = 4000): HistoryMatch[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT * FROM handball_match_history
         WHERE date >= date('now', ?)
         ORDER BY date DESC
         LIMIT ?`
      )
      .all(`-${days} days`, limit) as Record<string, unknown>[];
    return rows.map(toMatch);
  } catch {
    return [];
  }
}

/** Purge des caches (tests / hot-reload). */
export function clearHistoryDbCache(): void {
  _db = null;
  _dbUnavailable = false;
}
