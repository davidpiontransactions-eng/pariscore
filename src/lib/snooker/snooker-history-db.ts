// Lecture readonly de l'historique snooker (data/snooker_history.db — extrait
// SnookerDB/CueTracker généré par scripts/fetch-snooker-history.mjs, licence
// GPL-3.0, 126k matchs 1907→2026). Double driver identique à
// basketball-history-db.ts : bun:sqlite en priorité (runtime de prod = bun),
// better-sqlite3 en repli (node uniquement). Base absente/illisible → retour
// vide : l'API répond indisponible et l'UI dégrade proprement.

import path from "node:path";

/** Ligne de backtest normalisée (types NATIFS — les colonnes SQLite sont TEXT). */
export type SnookerBacktestRow = {
  date: string;
  stage: string;
  best_of: number;
  player_1_score: number;
  player_2_score: number;
  player_1: string;
  player_2: string;
  player_1_url: string;
  player_2_url: string;
  season: string;
  category: string;
  tournament: string;
};

export type SnookerRankingRow = {
  season: string;
  player_url: string;
  start_position: number | null;
};

type BSD = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
  close: () => void;
};

const SQLITE_FILE =
  process.env.SNOOKER_HISTORY_DB ||
  path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "snooker_history.db");

/** Ouvre un fichier sqlite readonly — bun:sqlite d'abord, better-sqlite3 en repli node. */
function openSqlite(file: string): BSD {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as {
      Database: new (file: string, opts?: object) => BSD;
    };
    return new Database(file, { readonly: true, create: false });
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

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/**
 * Slug joueur depuis une URL CueTracker (dernier segment, minuscules).
 *
 * La casse est le point critique : `players.url` utilise `/Players/x`
 * (majuscule) et `matches.player_1_url` `/players/x` (minuscule). Sans
 * `toLowerCase()`, la même personne existe en deux îlots.
 */
function slug(url: unknown): string {
  if (!url) return "";
  return String(url).split("/").pop()!.toLowerCase();
}

/** Matchs terminés avec scores exploitables, tri chronologique. */
export function loadSnookerBacktestRows(): SnookerBacktestRow[] {
  let db: BSD;
  try {
    db = openSqlite(SQLITE_FILE);
  } catch (err) {
    console.warn(
      `[snooker-history] ${SQLITE_FILE} illisible — backtest indisponible. Détail: ${(err as Error).message}`,
    );
    return [];
  }
  try {
    const rows = db
      .prepare(
        // ⚠️ walkover est TEXT avec deux encodages upstream ('False'/'True'
        // historique, '0'/'1' récent) → filtre sémantique, pas `= 0`.
        // Date vide (65k lignes historiques) → repli sur start_date du tournoi
        // (même format ISO, ordre chronologique globale conservé).
        //
        // ⚠️ VAINQUEUR EN SLOT 1. La base stocke le vainqueur en premier : le
        // slot 1 gagne dans 96,7 % des lignes (121 343 / 121 345 sur
        // l'historique). On ne peut donc PAS déduire le vainqueur de
        // `player_1_score > player_2_score` — ce test est vrai presque toujours,
        // et le backtest affichait une accuracy calculée sur une étiquette
        // constante. On sélectionne `winner_url` et `m.winner`, et
        // `outcome` est recalculé plus bas à partir de l'identité du vainqueur.
        "SELECT COALESCE(NULLIF(m.date, ''), t.start_date) AS date, m.stage, m.best_of, " +
          "m.player_1_score, m.player_2_score, " +
          "m.player_1, m.player_2, m.player_1_url, m.player_2_url, " +
          "m.winner, m.winner_url, " +
          "t.season, t.category, t.name AS tournament " +
          "FROM matches m JOIN tournament t ON m.tourn_id = t.tourn_id " +
          "WHERE COALESCE(NULLIF(m.date, ''), t.start_date) IS NOT NULL " +
          "AND LOWER(m.walkover) NOT IN ('1', 'true') " +
          "AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER) " +
          "AND CAST(m.player_1_score AS INTEGER) > 0 " +
          "AND m.winner_url IS NOT NULL AND m.winner_url <> '' " +
          "ORDER BY date",
      )
      .all() as Record<string, unknown>[];

    // Reconstitution du couple (vainqueur, perdant) puis remise dans l'ordre
    // d'origine : `outcome` dans `backtest-history.ts` reste inchangé, mais il
    // porte maintenant sur des scores réellement attribués.
    const out: Record<string, unknown>[] = [];
    for (const r of rows) {
      const s1 = slug(r.player_1_url);
      const s2 = slug(r.player_2_url);
      const winner = slug(r.winner_url);
      if (!s1 || !s2 || s1 === s2) continue;
      // `winner_url` doit désigner l'un des deux ; sinon la ligne est inexploitable.
      if (winner !== s1 && winner !== s2) continue;

      const a = num(r.player_1_score);
      const b = num(r.player_2_score);
      const winnerIsSlot1 = winner === s1;
      const framesWinner = winnerIsSlot1 ? a : b;
      const framesLoser = winnerIsSlot1 ? b : a;
      // Cohérence obligatoire : le vainqueur a gagné plus de frames. Les lignes
      // qui violent cette règle (3,35 % mesurés) sont saisies contradictoires.
      if (framesWinner <= framesLoser) continue;

      out.push({
        ...r,
        player_1_url: winnerIsSlot1 ? r.player_1_url : r.player_2_url,
        player_2_url: winnerIsSlot1 ? r.player_2_url : r.player_1_url,
        player_1: winnerIsSlot1 ? r.player_1 : r.player_2,
        player_2: winnerIsSlot1 ? r.player_2 : r.player_1,
        player_1_score: framesWinner,
        player_2_score: framesLoser,
      });
    }

    return out.map((r) => ({
      date: str(r.date),
      stage: str(r.stage),
      best_of: num(r.best_of) || 9,
      player_1_score: num(r.player_1_score),
      player_2_score: num(r.player_2_score),
      player_1: str(r.player_1),
      player_2: str(r.player_2),
      player_1_url: str(r.player_1_url),
      player_2_url: str(r.player_2_url),
      season: str(r.season),
      category: str(r.category),
      tournament: str(r.tournament),
    }));
  } catch (err) {
    console.warn(
      `[snooker-history] lecture matches échouée — backtest indisponible. Détail: ${(err as Error).message}`,
    );
    return [];
  } finally {
    db.close();
  }
}

/** Classements officiels par saison (baseline « favori au classement »). */
export function loadSnookerRankings(): SnookerRankingRow[] {
  let db: BSD;
  try {
    db = openSqlite(SQLITE_FILE);
  } catch {
    return [];
  }
  try {
    const rows = db
      .prepare("SELECT season, player_url, start_position FROM rankings")
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      season: str(r.season),
      player_url: str(r.player_url),
      start_position: r.start_position == null ? null : num(r.start_position),
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}
