// Lecture readonly de l'historique basketball (table `basketball_match_history`
// de pariscore.db) — bun:sqlite en priorité (runtime de prod pm2 = bun),
// better-sqlite3 en repli (node uniquement : better-sqlite3 n'est pas supporté
// sous bun, cf. oven-sh/bun#4290). Base indisponible → retour vide, l'UI
// dégrade proprement.
//
// ⚠️ Piège prod (entry 99 .context/RAPPORT-TACHES.md) : sous pm2 le cwd du
// process Next standalone est `.next/standalone` (server.js fait
// process.chdir(__dirname)) et sa copie `pariscore.db` — tracée par le file
// tracing du build — est un SNAPSHOT du build : elle peut n'avoir pas la table
// (serve meta:null silencieux) ou l'avoir périmée (données figées). Ordre des
// candidats : DATABASE_PATH explicite > racine projet (parent) > copie cwd.
// Le require("bun:sqlite") LITTÉRAL est volontaire : le stub bundler
// [externals] le réécrit en require natif intact (prouvé en prod) — ne pas le
// transformer en indirection.
//
// La table est peuplée par seed_historique_basketball.js (racine) :
// NBA/WNBA via ESPN site.web scoreboard par jour, EuroLeague/EuroCup via
// api-live.euroleague.net v2 games.

import path from "node:path";

export type BasketballHistoryMatch = {
  key: string;
  date: string;
  timeUtc: string | null;
  home: string;
  away: string;
  homeKey: string;
  awayKey: string;
  homeScore: number;
  awayScore: number;
  homeQuarters: number[] | null;
  awayQuarters: number[] | null;
  league: string | null;
  season: string | null;
  round: string | null;
  venue: string | null;
  winnerKey: string | null;
  src: string | null;
};

export type BasketballHistoryByLeague = {
  league: string;
  n: number;
  minDate: string;
  maxDate: string;
};

export type BasketballHistoryMeta = {
  total: number;
  byLeague: BasketballHistoryByLeague[];
};

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

/** Ouvre un fichier sqlite readonly — bun:sqlite d'abord, better-sqlite3 en repli node. */
function openSqlite(file: string): BSD {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as {
      Database: new (file: string, opts?: object) => BSD;
    };
    return new Database(file, { readonly: true });
  } catch (bunErr) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3") as unknown as {
        new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): BSD;
      };
      return new Database(file, { readonly: true, fileMustExist: true });
    } catch (err) {
      throw new Error(
        `bun:sqlite: ${(bunErr as Error).message} | better-sqlite3: ${(err as Error).message}`,
      );
    }
  }
}

/** La table basketball_match_history existe-t-elle dans cette base ? */
function hasHistoryTable(db: BSD): boolean {
  try {
    return !!db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='basketball_match_history' LIMIT 1",
      )
      .get();
  } catch {
    return false;
  }
}

/**
 * Fichiers candidats, par priorité :
 * 1. DATABASE_PATH explicite (seul candidat) — pattern crons oddalerts/vitibet ;
 * 2. sinon, en contexte Next standalone (cwd = .next/standalone) : racine
 *    projet (../pariscore.db) D'ABORD — la copie tracée est un snapshot du
 *    build, potentiellement absente ou périmée — puis la copie cwd en repli ;
 * 3. sinon (dev/scripts, cwd = racine) : cwd d'abord, parent en repli.
 */
function dbCandidates(): string[] {
  const cwd = process.cwd();
  const cwdDb = path.join(cwd, "pariscore.db");
  if (SQLITE_FILE !== cwdDb) return [SQLITE_FILE];
  const parentDb = path.join(cwd, "..", "pariscore.db");
  return path.basename(cwd) === "standalone" ? [parentDb, cwdDb] : [cwdDb, parentDb];
}

/**
 * Ouvre la base readonly — injectable pour les tests (":memory:").
 * Chaque candidat est validé : la table basketball_match_history doit exister.
 */
function getDb(file: string = SQLITE_FILE): BSD | null {
  if (_dbUnavailable && file === SQLITE_FILE) return null;
  if (_db && file === SQLITE_FILE) return _db;

  const candidates = file !== SQLITE_FILE ? [file] : dbCandidates();
  const attempts: string[] = [];
  for (const candidate of candidates) {
    let db: BSD;
    try {
      db = openSqlite(candidate);
    } catch (err) {
      attempts.push(`${candidate} → ${(err as Error).message.split("\n")[0]}`);
      continue;
    }
    if (!hasHistoryTable(db)) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      attempts.push(`${candidate} → table basketball_match_history absente`);
      continue;
    }
    if (file === SQLITE_FILE) _db = db;
    return db;
  }

  if (file === SQLITE_FILE) {
    _dbUnavailable = true;
    // Toujours loggé (prod compris) : un échec silencieux se traduit par des
    // listes vides sans aucune trace côté serveur.
    console.warn(
      `[basketball-history] base introuvable — historique basket désactivé. Tentatives: ${attempts.join(" ; ")}`,
    );
  }
  return null;
}

function toMatch(row: Record<string, unknown>): BasketballHistoryMatch {
  const quarters = (v: unknown): number[] | null => {
    if (typeof v !== "string" || !v) return null;
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : null;
    } catch {
      return null;
    }
  };
  return {
    key: String(row.key),
    date: String(row.date),
    timeUtc: row.time_utc != null ? String(row.time_utc) : null,
    home: String(row.home),
    away: String(row.away),
    homeKey: String(row.home_key),
    awayKey: String(row.away_key),
    homeScore: Number(row.home_score),
    awayScore: Number(row.away_score),
    homeQuarters: quarters(row.home_quarters),
    awayQuarters: quarters(row.away_quarters),
    league: row.league != null ? String(row.league) : null,
    season: row.season != null ? String(row.season) : null,
    round: row.round != null ? String(row.round) : null,
    venue: row.venue != null ? String(row.venue) : null,
    winnerKey: row.winner_key != null ? String(row.winner_key) : null,
    src: row.src != null ? String(row.src) : null,
  };
}

export type BasketballHistoryFilter = {
  league?: string;
  from?: string;
  to?: string;
  team?: string;
  limit?: number;
};

/** Matchs finis filtrés (chronologiques). team = match sur home_key OU away_key. */
export function loadBasketballHistory(
  filter: BasketballHistoryFilter = {},
  file?: string,
): BasketballHistoryMatch[] {
  const db = getDb(file);
  if (!db) return [];
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.league) {
    conds.push("league = ?");
    params.push(filter.league);
  }
  if (filter.from) {
    conds.push("date >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    conds.push("date <= ?");
    params.push(filter.to);
  }
  if (filter.team) {
    const team = filter.team.trim().toUpperCase();
    conds.push("(home_key = ? OR away_key = ?)");
    params.push(team, team);
  }
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 5000);
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  try {
    const rows = db
      .prepare(
        `SELECT * FROM basketball_match_history ${where} ORDER BY date DESC, time_utc DESC LIMIT ${limit}`,
      )
      .all(...params);
    return rows.map((r) => toMatch(r as Record<string, unknown>));
  } catch (err) {
    console.warn(`[basketball-history] query matches échouée: ${(err as Error).message}`);
    return [];
  }
}

/** Compteurs par ligue (total + bornes de dates) — null si base indisponible. */
export function basketballHistoryMeta(file?: string): BasketballHistoryMeta | null {
  const db = getDb(file);
  if (!db) return null;
  try {
    const rows = db
      .prepare(
        "SELECT league, COUNT(*) n, MIN(date) min, MAX(date) max FROM basketball_match_history GROUP BY league ORDER BY league",
      )
      .all();
    const byLeague = (rows as Record<string, unknown>[]).map((r) => ({
      league: String(r.league ?? "?"),
      n: Number(r.n),
      minDate: String(r.min),
      maxDate: String(r.max),
    }));
    return { total: byLeague.reduce((a, b) => a + b.n, 0), byLeague };
  } catch (err) {
    console.warn(`[basketball-history] query meta échouée: ${(err as Error).message}`);
    return null;
  }
}

/** Codes équipes distincts (slugs normalisés) — pour autocomplétion/H2H. */
export function listBasketballTeamKeys(file?: string): string[] {
  const db = getDb(file);
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        "SELECT DISTINCT key FROM (SELECT home_key AS key FROM basketball_match_history UNION SELECT away_key FROM basketball_match_history) ORDER BY key",
      )
      .all();
    return (rows as Record<string, unknown>[]).map((r) => String(r.key));
  } catch (err) {
    console.warn(`[basketball-history] query team keys échouée: ${(err as Error).message}`);
    return [];
  }
}
