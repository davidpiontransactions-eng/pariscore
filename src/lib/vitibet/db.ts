// Lecture des pronostics Vitibet (scrapés de vitibet.com) depuis pariscore.db.
//
// La table `vitibet_tips` est peuplée par scripts/scrape-vitibet.js
// (cron PM2 `pariscore-cron-vitibet`, 2 runs/jour sur le VPS).
// On ouvre la base en lecture seule (readonly) — même pattern que
// src/lib/leagues-stats/db.ts — pour ne jamais concurrencer les writers.
//
// Défensif : si la base ou la table est absente (dev local sans scraping),
// les fonctions retournent [] et l'UI dégrade gracieusement.

import path from "node:path";
import type {
  VitibetBacktestLeague,
  VitibetBacktestResult,
  VitibetBacktestSegment,
  VitibetTip,
  VitibetTipStatut,
  VitibetTipValue,
} from "./types";

type BSD = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
};

const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

let _db: BSD | null = null;
let _dbUnavailable = false;

function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as { Database: new (file: string, opts?: object) => BSD };
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
          `[vitibet] pariscore.db non lisible (${SQLITE_FILE}) — ` +
            `pronostics Vitibet désactivés. Détail: ${(err as Error).message}`
        );
      }
      return null;
    }
  }
}

/** Jour courant Europe/Paris (« AAAA-MM-JJ ») — début de fenêtre J → J+3. */
export function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Ajoute n jours à une date « AAAA-MM-JJ » (arithmétique UTC, sans fuseau). */
function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}

function toTipValue(v: unknown): VitibetTipValue | null {
  const s = v == null ? null : String(v);
  return s === "1" || s === "X" || s === "2" ? s : null;
}

function toStatut(v: unknown): VitibetTipStatut | null {
  const s = v == null ? null : String(v);
  return s === "scheduled" || s === "live" || s === "finished" ? s : null;
}

function rowToTip(row: Record<string, unknown>): VitibetTip {
  return {
    fixtureId: numOrNull(row.fixture_id) ?? 0,
    leagueId: numOrNull(row.league_id) ?? 0,
    sport: String(row.sport ?? "hazena"),
    dateMatch: String(row.date_match ?? ""),
    heure: strOrNull(row.heure),
    equipeDom: String(row.equipe_dom ?? ""),
    equipeExt: String(row.equipe_ext ?? ""),
    tip: toTipValue(row.tip),
    indexValue: numOrNull(row.index_value),
    probHome: numOrNull(row.prob_home),
    probDraw: numOrNull(row.prob_draw),
    probAway: numOrNull(row.prob_away),
    scorePreditD: numOrNull(row.score_predit_d),
    scorePreditE: numOrNull(row.score_predit_e),
    statut: toStatut(row.statut),
    scoreReelD: numOrNull(row.score_reel_d),
    scoreReelE: numOrNull(row.score_reel_e),
    scrapedAt: strOrNull(row.scraped_at),
  };
}

/**
 * Pronostics de la fenêtre J → J+3 (date incluse), triés par jour puis heure.
 * Retourne [] si la table `vitibet_tips` n'existe pas encore (créée par le
 * scraper en parallèle) — dégradation gracieuse, jamais de crash.
 */
export function getTipsByDate(date: string): VitibetTip[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT * FROM vitibet_tips
         WHERE date_match >= ? AND date_match <= ?
         ORDER BY date_match ASC, heure ASC, fixture_id ASC`
      )
      .all(date, addDays(date, 3)) as Record<string, unknown>[];
    return rows.map(rowToTip);
  } catch {
    return [];
  }
}

/**
 * Top `limit` des pronostics J → J+3 par |INDEX| décroissant
 * (les favoris les plus lourds en tête) — tri « By INDEX value » de Vitibet.
 */
export function getTopByIndex(limit: number): VitibetTip[] {
  const db = getDb();
  if (!db) return [];
  const n = Math.max(1, Math.floor(limit) || 10);
  try {
    const from = parisToday();
    const rows = db
      .prepare(
        `SELECT * FROM vitibet_tips
         WHERE date_match >= ? AND date_match <= ?
           AND index_value IS NOT NULL
         ORDER BY ABS(index_value) DESC, date_match ASC, heure ASC
         LIMIT ?`
      )
      .all(from, addDays(from, 3), n) as Record<string, unknown>[];
    return rows.map(rowToTip);
  } catch {
    return [];
  }
}

/**
 * Backtest des tips Vitibet (T6) — taux de réussite réel : tip prédit vs
 * résultat FT (`score_reel_d/e`).
 *
 * Échantillon : lignes `statut='finished'` avec `tip` non-null ET score réel
 * complet. Succès du tip : '1' si buts domicile > extérieur, '2' si <, 'X' si
 * égalité (score FT réglementaire affiché par Vitibet — vérifié sur données
 * réelles, les nuls existent en championnat). Les matchs finished sans tip
 * sont comptés à part (`excludedNoTip`) et exclus du taux.
 * Retourne un résultat vide si la table est absente ou vide (jamais de crash).
 */
export function getBacktest(): VitibetBacktestResult {
  const seg = (): VitibetBacktestSegment => ({ total: 0, hits: 0, rate: 0 });
  const db = getDb();
  if (!db) {
    return {
      total: 0,
      hits: 0,
      rate: 0,
      byTip: { "1": seg(), X: seg(), "2": seg() },
      byLeague: [],
      sampleDates: [],
      excludedNoTip: 0,
    };
  }
  try {
    const rows = db
      .prepare(
        `SELECT league_id, date_match, tip, score_reel_d, score_reel_e
         FROM vitibet_tips
         WHERE statut = 'finished'`
      )
      .all() as Record<string, unknown>[];

    const byTip: Record<VitibetTipValue, VitibetBacktestSegment> = {
      "1": seg(),
      X: seg(),
      "2": seg(),
    };
    const leagues = new Map<number, { total: number; hits: number }>();
    const dates = new Set<string>();
    let total = 0;
    let hits = 0;
    let excludedNoTip = 0;

    for (const row of rows) {
      const tip = toTipValue(row.tip);
      if (tip === null) {
        // finished sans tip → hors taux, compté pour transparence
        excludedNoTip++;
        continue;
      }
      const dom = numOrNull(row.score_reel_d);
      const ext = numOrNull(row.score_reel_e);
      if (dom === null || ext === null) continue; // score incomplet → non évaluable

      const outcome: VitibetTipValue = dom > ext ? "1" : dom < ext ? "2" : "X";
      const hit = outcome === tip ? 1 : 0;

      total++;
      hits += hit;
      byTip[tip].total++;
      byTip[tip].hits += hit;

      const leagueId = numOrNull(row.league_id) ?? 0;
      const league = leagues.get(leagueId) ?? { total: 0, hits: 0 };
      league.total++;
      league.hits += hit;
      leagues.set(leagueId, league);

      const date = strOrNull(row.date_match);
      if (date) dates.add(date);
    }

    for (const key of ["1", "X", "2"] as const) {
      byTip[key].rate = byTip[key].total > 0 ? byTip[key].hits / byTip[key].total : 0;
    }
    const byLeague: VitibetBacktestLeague[] = [...leagues.entries()]
      .map(([leagueId, s]) => ({
        leagueId,
        total: s.total,
        hits: s.hits,
        rate: s.total > 0 ? s.hits / s.total : 0,
      }))
      .sort((a, b) => b.total - a.total || a.leagueId - b.leagueId);

    return {
      total,
      hits,
      rate: total > 0 ? hits / total : 0,
      byTip,
      byLeague,
      sampleDates: [...dates].sort(),
      excludedNoTip,
    };
  } catch {
    return {
      total: 0,
      hits: 0,
      rate: 0,
      byTip: { "1": seg(), X: seg(), "2": seg() },
      byLeague: [],
      sampleDates: [],
      excludedNoTip: 0,
    };
  }
}
