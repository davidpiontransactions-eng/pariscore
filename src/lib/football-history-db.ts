// Lecture readonly de l'historique foot (tables `corner_history` et
// `match_stats_history` de pariscore.db) — même pattern défensif que
// src/lib/handball-history-db.ts : bun:sqlite en priorité (runtime de prod),
// better-sqlite3 en repli (node), base/table absente → retour vide et l'UI
// dégrade proprement.
//
// Peuplement : seed_historique_bsd_stats.js / seed_historique_bsd_corners.js
// (backfill BSD) + scripts/cron_refresh_match_stats.js
// (cron PM2 `pariscore-cron-match-stats`, quotidien 03:00 UTC).
// `match_date` est stocké en YYYY-MM-DD (event_date BSD tronqué au jour).

import path from "node:path";

type BSD = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
  close: () => void;
};

/** Chemin résolu à l'ouverture (tests : DATABASE_PATH injecté avant import). */
function dbFile(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");
}

/** Lignes utiles de `match_stats_history` pour l'onglet Résultats. */
export type MatchStatsHistoryRow = {
  bsdEventId: string;
  bsdLeagueId: string | null;
  season: string | null;
  matchDate: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeSot: number | null;
  awaySot: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  homeXg: number | null;
  awayXg: number | null;
};

/** Lignes utiles de `corner_history`. */
export type CornerHistoryRow = {
  bsdEventId: string | null;
  bsdLeagueId: string | null;
  season: string | null;
  matchDate: string | null;
  homeTeam: string;
  awayTeam: string;
  homeCorners: number | null;
  awayCorners: number | null;
  totalCorners: number | null;
};

let _db: BSD | null = null;
let _dbUnavailable = false;

function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  const SQLITE_FILE = dbFile();
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
      console.warn(
        `[football-history] ${SQLITE_FILE} non lisible — enrichissement corners/SOT désactivé. ` +
          `Détail: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

function tableExists(db: BSD, name: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
  return row != null;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toMatchStats(row: Record<string, unknown>): MatchStatsHistoryRow {
  return {
    bsdEventId: String(row.bsd_event_id),
    bsdLeagueId: row.bsd_league_id != null ? String(row.bsd_league_id) : null,
    season: row.season != null ? String(row.season) : null,
    matchDate: row.match_date != null ? String(row.match_date) : null,
    homeTeam: String(row.home_team ?? ""),
    awayTeam: String(row.away_team ?? ""),
    homeScore: numOrNull(row.home_score),
    awayScore: numOrNull(row.away_score),
    homeSot: numOrNull(row.home_sot),
    awaySot: numOrNull(row.away_sot),
    homeShots: numOrNull(row.home_shots),
    awayShots: numOrNull(row.away_shots),
    homeCorners: numOrNull(row.home_corners),
    awayCorners: numOrNull(row.away_corners),
    homeXg: numOrNull(row.home_xg),
    awayXg: numOrNull(row.away_xg),
  };
}

function toCorners(row: Record<string, unknown>): CornerHistoryRow {
  return {
    bsdEventId: row.bsd_event_id != null ? String(row.bsd_event_id) : null,
    bsdLeagueId: row.bsd_league_id != null ? String(row.bsd_league_id) : null,
    season: row.season != null ? String(row.season) : null,
    matchDate: row.match_date != null ? String(row.match_date) : null,
    homeTeam: String(row.home_team ?? ""),
    awayTeam: String(row.away_team ?? ""),
    homeCorners: numOrNull(row.home_corners),
    awayCorners: numOrNull(row.away_corners),
    totalCorners: numOrNull(row.total_corners),
  };
}

/** Découpe les ids en paquets (limite SQLite sur les paramètres IN). */
function chunk<T>(list: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Stats de match archivées, indexées par `bsd_event_id`. */
export function loadMatchStatsHistoryByEventIds(
  ids: string[],
): Map<string, MatchStatsHistoryRow> {
  const out = new Map<string, MatchStatsHistoryRow>();
  const db = getDb();
  if (!db || ids.length === 0 || !tableExists(db, "match_stats_history")) return out;
  for (const part of chunk(ids)) {
    const rows = db
      .prepare(
        `SELECT * FROM match_stats_history WHERE bsd_event_id IN (${part.map(() => "?").join(",")})`,
      )
      .all(...part) as Record<string, unknown>[];
    for (const r of rows) {
      const m = toMatchStats(r);
      if (!out.has(m.bsdEventId)) out.set(m.bsdEventId, m);
    }
  }
  return out;
}

/** Stats de match archivées sur une plage de dates (YYYY-MM-DD, bornes incluses). */
export function loadMatchStatsHistoryRange(
  fromISO: string,
  toISO: string,
): MatchStatsHistoryRow[] {
  const db = getDb();
  if (!db || !tableExists(db, "match_stats_history")) return [];
  const rows = db
    .prepare(
      "SELECT * FROM match_stats_history WHERE match_date >= ? AND match_date <= ? ORDER BY match_date",
    )
    .all(fromISO, toISO) as Record<string, unknown>[];
  return rows.map(toMatchStats);
}

/** Corners archivés, indexés par `bsd_event_id` (lignes sans id ignorées). */
export function loadCornerHistoryByEventIds(ids: string[]): Map<string, CornerHistoryRow> {
  const out = new Map<string, CornerHistoryRow>();
  const db = getDb();
  if (!db || ids.length === 0 || !tableExists(db, "corner_history")) return out;
  for (const part of chunk(ids)) {
    const rows = db
      .prepare(
        `SELECT * FROM corner_history WHERE bsd_event_id IN (${part.map(() => "?").join(",")})`,
      )
      .all(...part) as Record<string, unknown>[];
    for (const r of rows) {
      const c = toCorners(r);
      if (c.bsdEventId != null && !out.has(c.bsdEventId)) out.set(c.bsdEventId, c);
    }
  }
  return out;
}

/** Corners archivés sur une plage de dates (YYYY-MM-DD, bornes incluses). */
export function loadCornerHistoryRange(fromISO: string, toISO: string): CornerHistoryRow[] {
  const db = getDb();
  if (!db || !tableExists(db, "corner_history")) return [];
  const rows = db
    .prepare(
      "SELECT * FROM corner_history WHERE match_date >= ? AND match_date <= ? ORDER BY match_date",
    )
    .all(fromISO, toISO) as Record<string, unknown>[];
  return rows.map(toCorners);
}

/** Fraîcheur des deux tables (volume + couverture) — pour l'UI « données archivées ». */
export function footballHistoryMeta(): {
  matchStats: { n: number; minDate: string | null; maxDate: string | null } | null;
  corners: { n: number; minDate: string | null; maxDate: string | null } | null;
} {
  const db = getDb();
  const empty = { matchStats: null, corners: null };
  if (!db) return empty;
  const meta = (table: string) => {
    if (!tableExists(db, table)) return null;
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n, MIN(match_date) AS minDate, MAX(match_date) AS maxDate FROM ${table}`,
      )
      .get() as { n: number; minDate: string | null; maxDate: string | null };
    return { n: Number(row.n) || 0, minDate: row.minDate ?? null, maxDate: row.maxDate ?? null };
  };
  return { matchStats: meta("match_stats_history"), corners: meta("corner_history") };
}

/** Reset du singleton (tests uniquement). */
export function clearFootballHistoryDbCache(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // déjà fermée
    }
  }
  _db = null;
  _dbUnavailable = false;
}
