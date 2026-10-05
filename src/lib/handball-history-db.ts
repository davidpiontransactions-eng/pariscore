// Lecture readonly de l'historique handball (table `handball_match_history`
// de pariscore.db) — même pattern défensif que src/lib/leagues-stats/db.ts :
// bun:sqlite en priorité (runtime de prod), better-sqlite3 en repli (node),
// base absente → retour vide / null et l'UI dégrade proprement.
//
// La table est peuplée par scripts/scrape-handball-history.mjs
// (cron PM2 `pariscore-cron-handball-history`, hebdomadaire lundi 04:20 UTC).

import path from "node:path";
import { teamKey, type HistoryMatch } from "./handball-history-stats";
import { leagueVariants, normalizeHandballLeague } from "./handball-league-registry";
import type { BacktestMatch } from "./handball-backtest-pariscore";

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
      // Toujours loggé (prod compris) : un échec silencieux se traduit par
      // « meta: null / teams: null » sans aucune trace côté serveur.
      console.warn(
        `[handball-history] ${SQLITE_FILE} non lisible — analyse handball désactivée. ` +
          `Détail: ${(err as Error).message}`
      );
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

/**
 * Tout l'historique pour le backtest matrice (scripts/backtest-handball-
 * matrix.ts) — SELECT statique trié par date, `limit` = garde-fou mémoire.
 */
export function loadAllHistory(limit = 20000): HistoryMatch[] {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT * FROM handball_match_history
         ORDER BY date
         LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[];
    return rows.map(toMatch);
  } catch {
    return [];
  }
}

/**
 * Séries RÉCENTES d'une équipe, prêtes pour le calcul de seuil de total.
 *
 * Renvoie les `limit` derniers matchs TERMINÉS (colonnes gf / ga / atHome),
 * en ordre CROISSANT (le plus ancien d'abord) — convention du form-store de
 * `handball-strategy-top8`, donc directement exploitable par
 * `buildFormStore`-like consumers et par `calculateOptimalOverGoals`.
 *
 * `atHome[i]` = le match i a été joué à DOMICILE. Cette colonne est indispensable
 * pour la Forme Calculée pondérée (une victoire à l'extérieur vaut moins).
 *
 * `limit` est un garde-fou mémoire : on ne veut que les derniers matchs, pas
 * l'historique complet d'une équipe (120 lignes suffisent largement pour un
 * seuil de total).
 */
export function loadTeamSeries(
  teamKey: string,
  limit = 12,
): { gf: number[]; ga: number[]; atHome: boolean[] } | null {
  const db = getDb();
  if (!db || !teamKey) return null;
  try {
    const rows = db
      .prepare(
        `SELECT date, home_key, away_key, home_goals, away_goals
         FROM handball_match_history
         WHERE home_key = ? OR away_key = ?
         ORDER BY date DESC, home_goals
         LIMIT ?`
      )
      .all(teamKey, teamKey, limit) as Record<string, unknown>[];
    if (rows.length === 0) return null;
    const gf: number[] = [];
    const ga: number[] = [];
    const atHome: boolean[] = [];
    // rows en DESC → on inverse pour obtenir l'ordre chronologique croissant.
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const isHome = String(r.home_key) === teamKey;
      gf.push(Number(isHome ? r.home_goals : r.away_goals));
      ga.push(Number(isHome ? r.away_goals : r.home_goals));
      atHome.push(isHome);
    }
    return { gf, ga, atHome };
  } catch {
    return null;
  }
}

/**
 * Séries de PLUSIEURS équipes en 1 requête par équipe, résolues par NOM.
 *
 * Une requête par équipe serait acceptable (≤ 20 équipes) mais on regroupe
 * ici pour que l'appelant reste simple et que le nombre de hits SQLite soit
 * borné par le nombre d'équipes demandées.
 *
 * Renvoie `null` pour une équipe absente de l'historique (jamais de zéros : le
 * composant distingue « pas d'historique » de « historique vide »).
 */export function loadTeamSeriesByNames(
  names: string[],
  limit = 12,
): Record<string, { gf: number[]; ga: number[]; atHome: boolean[] } | null> {
  const out: Record<string, { gf: number[]; ga: number[]; atHome: boolean[] } | null> = {};
  for (const name of names) out[name] = loadTeamSeries(teamKey(name), limit);
  return out;
}

/**
 * Les colonnes de cotes existent-elles ?
 *
 * Résultat mis en cache : `PRAGMA table_info` ne change pas en cours de process,
 * et la route est appelée à chaque rendu. `null` = base illisible.
 */
let _hasOdds: boolean | null = null;
function hasOddsColumns(db: { prepare: (s: string) => { all: () => unknown[] } }): boolean {
  if (_hasOdds !== null) return _hasOdds;
  try {
    const cols = db.prepare(`PRAGMA table_info(handball_match_history)`).all() as {
      name?: string;
    }[];
    _hasOdds = cols.some((c) => c.name === "odds_home");
  } catch {
    _hasOdds = false;
  }
  return _hasOdds;
}

/** Purge des caches (tests / hot-reload). */
export function clearHistoryDbCache(): void {
  _db = null;
  _dbUnavailable = false;
  _hasOdds = null;
}

// ─── Backtest par ligue (lecture du registre canonique) ──────────────────────

/** Couverture réelle d'une ligue — sert à alimenter le sélecteur du backtest. */
export type HistoryLeagueStats = {
  id: string;
  /** Nom canonique (`Pays: Ligue`). */
  league: string;
  n: number;
  /** Matchs disposant de cotes 1X2 réelles — seul segment du marché 1N2 jouable. */
  withOdds: number;
  minDate: string | null;
  maxDate: string | null;
};

/**
 * Couverture par ligue pour les ligues du registre, jointes au volume réel.
 *
 * Le `GROUP BY league` porte sur les VARIANTES, puis on coalesce via
 * `normalizeHandballLeague` : sans ça, `France: Starligue` (134 rows) et
 * `starligue` (72 rows) sortiraient comme deux ligues distinctes et le
 * sélecteur proposerait trois lignes pour un seul championnat.
 *
 * On joint le registre (9 ligues) et non l'inverse : une ligue présente en base
 * mais absente du registre n'a pas d'alias connu, la rattacher par heuristique
 * serait/deviner.
 *
 * ⚠️ DÉFAUT CORRIGÉ 2026-10-05 (constaté en prod, pas en local).
 * Cette requête référençait `odds_home` sans vérifier que la colonne existe.
 * Or les colonnes de cotes sont ajoutées par la migration `PRAGMA table_info` de
 * `scrape-handball-history.mjs` : une table créée par une version antérieure ne
 * les a pas. Le `prepare` levait alors `no such column: odds_home`, le `catch`
 * renvoyait `[]`, et l'API répondait « 0 ligue » — indiscernable d'une base vide.
 * Mesuré sur le VPS : table de 8 043 lignes, 16 colonnes, aucune colonne de
 * cotes, `last_run = 2026-09-28` (donc migration jamais appliquée).
 *
 * On teste donc le schéma avant d'écrire le SQL, et `withOdds` vaut 0 quand la
 * colonne manque — ce qui est VRAI (c'est exactement ce qu'on sait du marché).
 */
export function listHistoryLeagueStats(): HistoryLeagueStats[] {
  const db = getDb();
  if (!db) return [];
  try {
    const hasOdds = hasOddsColumns(db);
    const rows = db
      .prepare(
        `SELECT league,
                COUNT(*) AS n,
                ${hasOdds ? "SUM(CASE WHEN odds_home IS NOT NULL THEN 1 ELSE 0 END)" : "0"} AS with_odds,
                MIN(date)                             AS min_date,
                MAX(date)                             AS max_date
           FROM handball_match_history
          WHERE league IS NOT NULL
          GROUP BY league`,
      )
      .all() as Record<string, unknown>[];

    // Agrégation en mémoire : le nombre de variantes est faible (~259 lignes max)
    // et `normalizeHandballLeague` est une normalisation de chaîne, pas du SQL.
    const byId = new Map<string, HistoryLeagueStats>();
    for (const r of rows) {
      const raw = String(r.league);
      const canonical = normalizeHandballLeague(raw);
      if (!canonical) continue;
      const entry = byId.get(canonical);
      const n = Number(r.n || 0);
      const odds = Number(r.with_odds || 0);
      const min = r.min_date != null ? String(r.min_date) : null;
      const max = r.max_date != null ? String(r.max_date) : null;
      if (!entry) {
        byId.set(canonical, {
          id: canonical,
          league: canonical,
          n,
          withOdds: odds,
          minDate: min,
          maxDate: max,
        });
      } else {
        entry.n += n;
        entry.withOdds += odds;
        entry.minDate = minMin(entry.minDate, min);
        entry.maxDate = maxMax(entry.maxDate, max);
      }
    }
    return [...byId.values()].sort((a, b) => b.n - a.n);
  } catch {
    return [];
  }
}

function minMin(a: string | null, b: string | null): string | null {
  if (a == null) return b;
  if (b == null) return a;
  return a < b ? a : b;
}

function maxMax(a: string | null, b: string | null): string | null {
  if (a == null) return b;
  if (b == null) return a;
  return a > b ? a : b;
}

/**
 * Matchs terminés d'une ligue, prêts pour `runPariscoreBacktest`, avec les
 * cotes 1X2 réelles quand elles existent.
 *
 * `leagueId` est l'id du registre (`starligue`, `hla`, …) : le `WHERE` utilise
 * toutes ses variantes, donc une ligue historique écrite en slug ET en
 * `Pays: Ligue` est renvoyée en une seule série — condition indispensable au
 * walk-forward, qui suppose un historique continu.
 *
 * `withOddsOnly` ne garde que les matchs ayant une cote 1N2 complète : le
 * moteur applique sinon `SIM_ODDS_*` (cotes simulées 1xbet), ce qui produirait
 * un ROI 1N2 mesuré sur du fictif. true par défaut — on ne veut pas d'un
 * ROI presented comme réel et calculé sur des cotes inventées.
 *
 * Tri par date ASC : le moteur re-trie lui-même (`[...matches].sort`), mais
 * l'ordre d'entrée reste déterministe (tie-break sur `key`).
 */
export function loadLeagueBacktestMatches(
  leagueId: string,
  opts: { limit?: number; withOddsOnly?: boolean } = {},
): BacktestMatch[] {
  const db = getDb();
  if (!db) return [];
  const variants = leagueVariants(leagueId);
  // Id inconnu → aucune variante → `IN ()` invalide en SQL. On sort avant.
  if (variants.length === 0) return [];
  const limit = Math.max(1, Math.min(20000, opts.limit ?? 4000));
  const withOddsOnly = opts.withOddsOnly !== false;
  const placeholders = variants.map(() => "?").join(",");
  // Même garde que `listHistoryLeagueStats` : sans migration appliquée, la table
  // n'a pas les colonnes de cotes et le `SELECT` lèverait. On sélectionne les
  // colonnes conditionnellement plutôt que de laisser le `catch` renvoyer [].
  const hasOdds = hasOddsColumns(db);
  const oddsCols = hasOdds ? "odds_home, odds_draw, odds_away" : "NULL, NULL, NULL";
  const oddsClause =
    withOddsOnly && hasOdds
      ? "AND odds_home IS NOT NULL AND odds_draw IS NOT NULL AND odds_away IS NOT NULL"
      : "";
  try {
    const rows = db
      .prepare(
        `SELECT key, date, home, away, home_goals, away_goals, league,
                ${oddsCols}
           FROM handball_match_history
          WHERE league IN (${placeholders})
            AND home_goals IS NOT NULL AND away_goals IS NOT NULL
            ${oddsClause}
          ORDER BY date ASC, key ASC
          LIMIT ?`,
      )
      .all(...variants, limit) as Record<string, unknown>[];
    return rows.map((r) => {
      const hg = Number(r.home_goals);
      const ag = Number(r.away_goals);
      const odds: { home?: number; draw?: number; away?: number } = {};
      if (r.odds_home != null) odds.home = Number(r.odds_home);
      if (r.odds_draw != null) odds.draw = Number(r.odds_draw);
      if (r.odds_away != null) odds.away = Number(r.odds_away);
      return {
        id: String(r.key),
        date: String(r.date),
        league: String(r.league),
        home: String(r.home),
        away: String(r.away),
        homeGoals: hg,
        awayGoals: ag,
        odds: Object.keys(odds).length === 3 ? odds : undefined,
        // Rien de synthétique ici : tout vient de la base réelle. On pose le
        // champ à false explicitement pour que l'UI n'affiche pas de bandeau
        // « match synthétique » sur cette source.
        synthetic: false,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Moyenne de buts PAR MATCH d'une ligue (les deux équipes), mesurée sur sa
 * propre historique.
 *
 * Sert de prior neutre au moteur CMP. La constante globale `CMP_NEUTRAL_LAMBDA`
 * (28.5 par équipe) est un « tous championnats » : l'utiliser pour une ligue
 * précise biaise le prior, et d'autant plus que l'écart entre ligues est large
 * (31.8 buts/équipe en Herre Handbold contre 25.6 en 1. Division Women).
 *
 * `null` si la ligue n'a aucun match exploitable — jamais de valeur inventée.
 */
export function leagueGoalsPerMatch(leagueId: string): number | null {
  const db = getDb();
  if (!db) return null;
  const variants = leagueVariants(leagueId);
  if (variants.length === 0) return null;
  const placeholders = variants.map(() => "?").join(",");
  try {
    const r = db
      .prepare(
        `SELECT AVG(total) AS avg_total
           FROM (SELECT (home_goals + away_goals) AS total
                   FROM handball_match_history
                  WHERE league IN (${placeholders})
                    AND home_goals IS NOT NULL AND away_goals IS NOT NULL)`,
      )
      .get(...variants) as Record<string, unknown> | undefined;
    const v = r?.avg_total != null ? Number(r.avg_total) : NaN;
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
