// Lecture des stats joueurs (Elo, ranking, Elo Surface, SPS) depuis pariscore.db.
//
// Cette base SQLite est peuplée en production par `computeTennisElo()` (dans
// server.js) et le cron `cron_sps_updater.py`. On l'ouvre en lecture seule
// (readonly) pour ne jamais concurrencer les writers côté legacy.
//
// Les requêtes SQL sont préparées une fois (prepared statements) et les
// classements (Rang Elo Surface, Rang SPS) sont calculés via des fonctions
// fenêtres RANK() OVER (PARTITION BY surface ORDER BY ... DESC).
//
// IMPORTANT : cette fonction est défensive — si la base est absente, vide ou
// le joueur introuvable, elle retourne `null`. L'UI affiche alors un fallback
// `—` plutôt qu'une valeur trompeuse (#0 / Elo 1500).

import path from "node:path";
import type {
  PlayerStats,
  PlayerStatsMap,
  UISurface,
  DBSurface,
} from "./types";

// better-sqlite3 est un module natif CJS — import dynamique pour ne pas
// casser le bundler Next.js en dev et éviter de le charger côté client.
type BSD = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
  close: () => void;
  pragma: (s: string) => unknown;
};

const SQLITE_FILE =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "pariscore.db");

let _db: BSD | null = null;
let _dbUnavailable = false;

/**
 * Ouvre la connexion (singleton). Retourne null si la base est absente ou
 * illisible — l'appelant doit alors dégrader gracieusement.
 */
function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as unknown as {
      new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): BSD;
    };
    _db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
    return _db;
  } catch (err) {
    // Base absente en local dev → on ne retente pas à chaque appel.
    _dbUnavailable = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[tennis-stats] pariscore.db non lisible (${SQLITE_FILE}) — ` +
          `stats désactivées. Détail: ${(err as Error).message}`
      );
    }
    return null;
  }
}

/**
 * Normalisation de nom identique à `player-matcher.ts:normalize()` et au
 * `normName()` de server.js (NFD → strip diacritics → lowercase → collapse).
 * Dupliquée ici (plutôt qu'importée) pour garder ce module autonome côté
 * serveur sans tirer player-matcher.ts (qui importe elo-data.json).
 */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mapping surface UI (FR) → surface base (EN, format Sackmann). */
const SURFACE_FR_TO_DB: Record<UISurface, DBSurface> = {
  Dur: "Hard",
  "Terre battue": "Clay",
  Gazon: "Grass",
};

/** Conversion robuste : accepte aussi directement une valeur base (EN). */
function toDbSurface(surface: string): DBSurface | null {
  const s = surface?.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("dur") || s.startsWith("hard")) return "Hard";
  if (s.startsWith("terre") || s.startsWith("clay")) return "Clay";
  if (s.startsWith("gazon") || s.startsWith("grass")) return "Grass";
  if (s.startsWith("carpet")) return "Carpet";
  return null;
}

export function resolveDbSurface(surface: string): DBSurface | null {
  return (SURFACE_FR_TO_DB as Record<string, DBSurface>)[surface] ?? toDbSurface(surface);
}

type EloRow = {
  player_id: number | string;
  player_name: string;
  tour: string;
  surface: string;
  elo: number;
};

type OverallRow = {
  player_id: string;
  player_name: string;
  elo_rating: number | null;
  atp_rank: number | null;
  wta_rank: number | null;
  circuit: string | null;
};

type SpsRow = {
  sps: number | null;
  confidence_full: number | null;
  matches_played: number | null;
};

/**
 * Construit un index des Elo par surface pour une surface donnée, trié par
 * elo décroissant — permet de calculer le rang (surfaceEloRank) d'un joueur.
 * On met en cache la liste pour 30 min (elle ne change pas entre deux appels
 * pour la même surface).
 */
let _surfaceEloIndexCache: {
  surface: DBSurface | "ALL";
  rows: EloRow[];
  at: number;
} | null = null;
const SURFACE_ELO_INDEX_TTL_MS = 30 * 60_000;

function getSurfaceEloIndex(db: BSD, surface: DBSurface): EloRow[] {
  const now = Date.now();
  if (
    _surfaceEloIndexCache &&
    _surfaceEloIndexCache.surface === surface &&
    now - _surfaceEloIndexCache.at < SURFACE_ELO_INDEX_TTL_MS
  ) {
    return _surfaceEloIndexCache.rows;
  }
  // On prend le meilleur Elo connu du joueur sur cette surface (un même
  // joueur peut avoir plusieurs tours ATP/WTA; on garde le max).
  const rows = db
    .prepare(
      `SELECT player_id, player_name, tour, surface, MAX(elo) AS elo
       FROM tennis_elo
       WHERE surface = ?
       GROUP BY player_name, tour
       ORDER BY elo DESC`
    )
    .all(surface) as EloRow[];
  _surfaceEloIndexCache = { surface, rows, at: now };
  return rows;
}

let _spsIndexCache: {
  surface: string;
  rows: { player_id: number; sps: number }[];
  at: number;
} | null = null;
const SPS_INDEX_TTL_MS = 30 * 60_000;

function getSpsIndex(
  db: BSD,
  surface: DBSurface
): { player_id: number; sps: number }[] {
  const now = Date.now();
  if (
    _spsIndexCache &&
    _spsIndexCache.surface === surface &&
    now - _spsIndexCache.at < SPS_INDEX_TTL_MS
  ) {
    return _spsIndexCache.rows;
  }
  // Le SPS le plus récent par joueur+surface (la table a une PK composite
  // player_id+surface+match_id; on garde le dernier computed_at).
  const rows = db
    .prepare(
      `SELECT player_id, sps
       FROM player_surface_scores
       WHERE surface = ? AND sps IS NOT NULL
       GROUP BY player_id
       HAVING MAX(computed_at)
       ORDER BY sps DESC`
    )
    .all(surface) as { player_id: number; sps: number }[];
  _spsIndexCache = { surface, rows, at: now };
  return rows;
}

/**
 * Stats complètes pour UN joueur sur UNE surface.
 * Retourne null si le joueur n'est pas trouvé en base.
 */
export function getPlayerStats(
  name: string,
  surface: string
): PlayerStats | null {
  const db = getDb();
  if (!db) return null;

  const dbSurface = resolveDbSurface(surface);
  const normName = normalizeName(name);
  if (!normName) return null;

  // 1. Elo global + ranking ATP/WTA (join par player_name normalisé).
  const overall = db
    .prepare(
      `SELECT player_id, player_name, elo_rating, atp_rank, wta_rank, circuit
       FROM tennis_players_elo
       WHERE LOWER(player_name) = ?`
    )
    .all(normName)[0] as OverallRow | undefined;

  // 2. Elo Surface (sur la surface du match).
  let eloSurface: number | null = null;
  let surfaceEloRank: number | null = null;
  if (dbSurface) {
    const surfRows = getSurfaceEloIndex(db, dbSurface);
    const matchIdx = surfRows.findIndex(
      (r) => normalizeName(r.player_name) === normName
    );
    if (matchIdx >= 0) {
      eloSurface = surfRows[matchIdx].elo;
      surfaceEloRank = matchIdx + 1; // déjà trié DESC → rang = position+1
    }
  }

  // 3. SPS + rang SPS.
  let sps: number | null = null;
  let spsRank: number | null = null;
  let spsConfidence: number | null = null;
  let spsMatches: number | null = null;
  if (dbSurface) {
    const spsRows = getSpsIndex(db, dbSurface);
    // Pour la valeur + métadonnées, on lit la ligne la plus récente.
    const spsMeta = db
      .prepare(
        `SELECT sps, confidence_full, matches_played
         FROM player_surface_scores
         WHERE surface = ? AND player_id = ?
         ORDER BY computed_at DESC
         LIMIT 1`
      )
      .all(dbSurface, overall?.player_id)[0] as SpsRow | undefined;
    if (spsMeta) {
      sps = spsMeta.sps;
      spsConfidence = spsMeta.confidence_full;
      spsMatches = spsMeta.matches_played;
    }
    // Rang : position dans l'index trié DESC. On ne peut pas réutiliser
    // matchIdx ci-dessus car l'index SPS est par player_id (numérique).
    if (overall?.player_id && sps != null) {
      const pid = Number(overall.player_id);
      const idx = spsRows.findIndex((r) => r.player_id === pid);
      if (idx >= 0) spsRank = idx + 1;
    }
  }

  // Si on n'a absolument rien (joueur absent), on retourne null pour que
  // l'UI affiche le fallback `—` plutôt que des champs tous nuls.
  if (
    !overall &&
    eloSurface == null &&
    sps == null
  ) {
    return null;
  }

  return {
    elo: overall?.elo_rating ?? null,
    atpRank: overall?.atp_rank ?? null,
    wtaRank: overall?.wta_rank ?? null,
    eloSurface,
    surfaceEloRank,
    sps,
    spsRank,
    spsConfidence,
    spsMatches,
  };
}

/**
 * Stats batch pour plusieurs joueurs (ex: les 2 joueurs d'un match).
 * Retourne un map { [name]: PlayerStats }. Les joueurs introuvables sont
 * omis (l'appelant traite l'absence comme `—`).
 */
export function getPlayerStatsBatch(
  names: string[],
  surface: string
): PlayerStatsMap {
  const out: PlayerStatsMap = {};
  for (const name of names) {
    const stats = getPlayerStats(name, surface);
    if (stats) out[normalizeName(name)] = stats;
  }
  return out;
}

/** Pour tests : invalide les caches d'index. */
export function _invalidateCachesForTests(): void {
  _surfaceEloIndexCache = null;
  _spsIndexCache = null;
}
