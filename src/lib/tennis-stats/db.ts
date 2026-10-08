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

// Le runtime de prod est Bun (`/proc/PID/exe = .bun/bin/bun`), où
// `better-sqlite3` est REFUSÉ (« 'better-sqlite3' is not yet supported in Bun »)
// : le module est bloqué à la source, ce n'est pas un conflit d'ABI corrigeable
// par un rebuild. Mesuré en prod le 2026-10-08 : l'ouverture échouait en
// SILENCE (le catch ne loguait qu'en dev), `getDb()` renvoyait null et TOUT le
// chemin DB était mort (Elo surface, rang SPS, SPS, DR) alors que la base
// contient 28 585 lignes SPS. Le sous-ensemble L10 (Prisma) marchait, ce qui
// faisait croire à une absence de données.
//
// Pattern établi par les modules frères (handball-history-db.ts,
// basketball-history-db.ts, snooker-history-db.ts) : `bun:sqlite` d'abord (le
// SEUL chemin qui fonctionne sous Bun), `better-sqlite3` en repli (node).

import path from "node:path";
import { existsSync } from "node:fs";
import type {
  PlayerStats,
  PlayerStatsMap,
  UISurface,
  DBSurface,
} from "./types";
import { lookupDrMoyen, lookupServeStats } from "@/lib/tennis-dr/lookup";

// better-sqlite3 est un module natif CJS — repli node uniquement.
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
  // Fichier absent : échec DISTINCT et nommé (cf. handball-history-db.ts).
  // turbopackIgnore : chemin calculé (DATABASE_PATH / cwd) — sans cette
  // annotation Turbopack trace le projet entier (bead ParisScorebis-r4g8).
  if (!existsSync(/*turbopackIgnore: true*/ SQLITE_FILE)) {
    _dbUnavailable = true;
    console.warn(
      `[tennis-stats] pariscore.db introuvable : ${SQLITE_FILE} ` +
        `(cwd=${process.cwd()}, DATABASE_PATH=${process.env.DATABASE_PATH ?? "non défini"}). ` +
        "Stats tennis désactivées (SPS / DR / rang surface) — l'UI affiche `—`."
    );
    return null;
  }
  try {
    _db = openNativeSqlite();
    return _db;
  } catch (bunErr) {
    try {
      // Runtime Node : `bun:sqlite` n'existe pas, `better-sqlite3` est le seul
      // pilote et fonctionne (binding N-API compile pour l'ABI du Node courant).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3") as unknown as {
        new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): BSD;
      };
      _db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
      return _db;
    } catch (nodeErr) {
      _dbUnavailable = true;
      // Les DEUX erreurs sont journalisées, TOUJOURS (pas de guard NODE_ENV) :
      // c'est l'échec silencieux en prod qui a coûté toute la mission SPS/DR —
      // l'API annonçait « — » alors que la base était pleinement peuplée.
      console.warn(
        `[tennis-stats] Aucun pilote SQLite n'a pu ouvrir ${SQLITE_FILE} — ` +
          `bun:sqlite: ${errMessage(bunErr)} · better-sqlite3: ${errMessage(nodeErr)}. ` +
          `(cwd=${process.cwd()}, DATABASE_PATH=${process.env.DATABASE_PATH ?? "non défini"}). ` +
          "Stats tennis désactivées (SPS / DR / rang surface)."
      );
      return null;
    }
  }
}

function errMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  // Les deux pilotes renvoient des messages multi-lignes très verbeux (liste de
  // tous les chemins de binding candidats) : on garde la première ligne.
  return m.split("\n")[0].slice(0, 200);
}

/**
 * Ouvre la base avec `bun:sqlite`, en contournant l'analyse statique du bundler.
 *
 * `eval("require")` rend l'appel invisible à l'analyse statique : le bundler
 * laisse la résolution au runtime, qui sait charger `bun:sqlite` nativement.
 * C'est le contournement standard pour charger un module runtime dans un bundle
 * — et LE chemin qui fonctionne sous Bun, où `require("bun:sqlite")` littéral
 * était réécrit en résolution Node (et échouait).
 */
function openNativeSqlite(): BSD {
  const req = eval("require") as NodeRequire;
  const { Database } = req("bun:sqlite") as {
    Database: new (file: string, opts?: object) => BSD;
  };
  return new Database(SQLITE_FILE, { readonly: true });
}

/**
 * Normalisation de nom identique à `player-matcher.ts:normalize()` et au
 * `normName()` de server.js (NFD → strip diacritics → lowercase → collapse).
 * Dupliquée ici (plutôt qu'importée) pour garder ce module autonome côté
 * serveur sans tirer player-matcher.ts (qui importe elo-data.json).
 */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Formes de nom à essayer contre `tennis_players_elo.player_name`, de la plus
 * précise à la plus large.
 *
 * Les APIs sources servent les joueurs en « Prénom N. » / « N. Prénom »
 * (« Tsitsipas S. ») alors que la base stocke le nom complet
 * (« Stefanos Tsitsipas ») : l'égalité stricte ne matchait rien et la carte
 * retombait sur `Elo 1500 / #— / SPS —`. Exportée pour les tests.
 */
export function playerNameCandidates(name: string): string[] {
  const base = normalizeName(name);
  if (!base) return [];
  const parts = base.split(" ").filter(Boolean);
  const out = [base];
  // « tsitsipas s » → « s tsitsipas » (initiales remontées devant).
  const initials = parts.filter((p) => p.length === 1);
  const surnames = parts.filter((p) => p.length > 1);
  if (initials.length > 0 && surnames.length > 0) {
    out.push(`${initials.join(" ")} ${surnames.join(" ")}`);
  }
  // Nom de famille = token le plus long, pas le dernier : les APIs écrivent
  // « Tsitsipas S. » comme « S. Tsitsipas », donc « s » peut finir la liste.
  const family = parts
    .filter((p) => p.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  if (family && parts.length > 1) out.push(family);
  return [...new Set(out)];
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
       WHERE surface = ? COLLATE NOCASE AND sps IS NOT NULL
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
  // FIX 2026-07-19 : certains joueurs ont 2 entrées dans tennis_players_elo
  // (IDs différents selon la source). On prend la plus récente (updated_at DESC)
  // et on retente avec la meilleure si aucune SPS n'est trouvée.
  // Les noms sources sont abrégés (« Tsitsipas S. ») : on essaie chaque variante
  // de playerNameCandidates avant de tomber sur un LIKE ancré sur le nom de
  // famille (le nom complet de la base ne matche aucune égalité).
  const overallStmt = db.prepare(
    `SELECT player_id, player_name, elo_rating, atp_rank, wta_rank, circuit
     FROM tennis_players_elo
     WHERE LOWER(player_name) = ?
     ORDER BY elo_rating DESC`
  );
  let allOveralls: OverallRow[] = [];
  let matchedName = normName;
  for (const candidate of playerNameCandidates(name)) {
    const rows = overallStmt.all(candidate) as OverallRow[];
    if (rows.length > 0) {
      allOveralls = rows;
      matchedName = candidate;
      break;
    }
  }
  if (allOveralls.length === 0) {
    // ponytail: LIKE sur le nom de famille en dernier recours — suffit pour les
    // variantes d'écriture restantes ; passer à un fuzzy edit-distance si les
    // captures « #— » persistent sur des noms sans famille recognizable.
    const surname = normName.split(" ").filter((p) => p.length >= 4).pop();
    if (surname) {
      const rows = db
        .prepare(
          `SELECT player_id, player_name, elo_rating, atp_rank, wta_rank, circuit
           FROM tennis_players_elo
           WHERE LOWER(player_name) LIKE ?
           ORDER BY elo_rating DESC
           LIMIT 3`
        )
        .all(`%${surname}%`) as OverallRow[];
      if (rows.length > 0) {
        allOveralls = rows;
        matchedName = normalizeName(rows[0].player_name);
      }
    }
  }
  const overall = allOveralls[0];

  // 2. Elo Surface (sur la surface du match).
  let eloSurface: number | null = null;
  let surfaceEloRank: number | null = null;
  if (dbSurface) {
    const surfRows = getSurfaceEloIndex(db, dbSurface);
    const matchIdx = surfRows.findIndex(
      (r) => normalizeName(r.player_name) === matchedName
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
  let spsPlayerId: string | null = null;
  if (dbSurface) {
    const spsRows = getSpsIndex(db, dbSurface);
    // FIX 2026-07-19 : certains joueurs ont 2+ entrées dans tennis_players_elo
    // avec des player_id différents (206173 vs 516 pour Sinner). On itère
    // sur tous les PIDs jusqu'à trouver celui qui a un SPS en base.
    const spsStmt = db.prepare(
      `SELECT sps, confidence_full, matches_played
       FROM player_surface_scores
       WHERE surface = ? COLLATE NOCASE AND player_id = ?
       ORDER BY computed_at DESC
       LIMIT 1`
    );
    for (const candidate of allOveralls) {
      const pid = candidate?.player_id;
      if (!pid) continue;
      const row = spsStmt.all(dbSurface, pid)[0] as SpsRow | undefined;
      if (row && row.sps != null) {
        sps = row.sps;
        spsConfidence = row.confidence_full;
        spsMatches = row.matches_played;
        spsPlayerId = pid;
        break;
      }
    }
    // Rang : position dans l'index trié DESC.
    if (spsPlayerId && sps != null) {
      const pid = Number(spsPlayerId);
      const idx = spsRows.findIndex((r) => r.player_id === pid);
      if (idx >= 0) spsRank = idx + 1;
    }
  }

  // 4. DR Moyen (5M) — médiane TennisAbstract filtrée surface (cache JSON).
  // lookupDrMoyen retourne null si joueur absent du cache ; on ignore alors.
  // On interroge avec `matchedName` (nom résolu en base) : les resolvers JSON
  // n'ont pas de repli sur les noms abrégés (« Tsitsipas S. » → null).
  const drMoyen5m = dbSurface ? lookupDrMoyen(matchedName, dbSurface) : null;

  // 5. Stats de service (modèles Over/Under Games + Most Aces). lookupServeStats
  //    renvoie { servePtsWonPct, returnPtsWonPct, acesPct, dfPct } depuis le
  //    cache DR étendu (médianes 5 et 10 derniers matchs surface).
  const serveStats = dbSurface
    ? lookupServeStats(matchedName, dbSurface)
    : { servePtsWonPct: null, returnPtsWonPct: null, acesPct: null, dfPct: null };

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
    drMoyen5m,
    servePtsWonPct: serveStats.servePtsWonPct,
    returnPtsWonPct: serveStats.returnPtsWonPct,
    acesPct: serveStats.acesPct,
    dfPct: serveStats.dfPct,
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
