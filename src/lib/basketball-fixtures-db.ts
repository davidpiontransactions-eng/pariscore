/**
 * basketball-fixtures-db.ts — table des fixtures UPCOMING (distincte de
 * `basketball_match_history`, qui ne porte que des résultats historiques).
 *
 * ⚠️ Périmètre d'honnêteté des colonnes : le cache BSD ne contient QUE :
 *   - identité + statut + scores de la fixture
 *   - prédiction FILTRÉE (prob_home/away, elo, confiance)
 *   - pregame (standings, last-10, venue, coach)
 *   - cotes MONEYLINE 2-way (home/away) + leur devig
 *
 * Les lignes AH et OU **ne sont PAS persistées** : le cron ne les capture pas
 * encore (les a relues en direct pour l'analyse J4). Ces colonnes n'existent
 * donc PAS ici — les créer en les laissant vides donnerait à un futur lecteur
 * l'impression qu'elles sont peuplées. Elles arrivent avec l'extension P-B.
 *
 * Même discipline que basketball-history-db : ordre des candidats de base
 * (DATABASE_PATH > racine > cwd), piège pm2/standalone documenté.
 */

import fs from "node:fs";
import path from "node:path";

import { basketCalibration } from "./basketball-calibration";

export type BasketballFixtureRow = {
  bsdEventId: number;
  league: string;
  leagueBsdId: number;
  scheduledAt: string;
  status: string;
  homeKey: string;
  awayKey: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;

  // Prédiction (filtrée : prob_over_* jamais stocké — règle d'intégrité)
  probHome: number | null;
  probAway: number | null;
  eloHome: number | null;
  eloAway: number | null;
  confidence: string | null;
  modelVersion: string | null;

  // Marché ML (seul marché persisté aujourd'hui)
  mlOddsHome: number | null;
  mlOddsAway: number | null;
  mlFairHome: number | null;
  mlFairAway: number | null;
  mlVigPct: number | null;
  mlBooks: number | null;

  // Pregame
  homeStanding: string | null;
  awayStanding: string | null;
  last10ScoredHome: number | null;
  last10ScoredAway: number | null;
  last10TotalHome: number | null;
  last10TotalAway: number | null;
  venue: string | null;

  /**
   * Lignes AH / OU — `null` = la source n'en a pas livré.
   * `fairFirst`/`fairSecond` : probabilités justes après retrait de marge.
   * `bestFirst`/`bestSecond` : meilleur prix observable.
   * Pour AH, First = Domicile ; pour OU, First = Over.
   */
  ahLine: number | null;
  ahBooks: number | null;
  ahFairFirst: number | null;
  ahFairSecond: number | null;
  ahVigPct: number | null;
  ahBestFirst: number | null;
  ahBestSecond: number | null;
  ouLine: number | null;
  ouBooks: number | null;
  ouFairFirst: number | null;
  ouFairSecond: number | null;
  ouVigPct: number | null;
  ouBestFirst: number | null;
  ouBestSecond: number | null;

  /** Marqueur d'horodatage de la source, pas l'heure locale de lecture. */
  sourceFetchedAt: string;
  updatedAt: string;
};

export const BASKETBALL_FIXTURES_DDL = `
CREATE TABLE IF NOT EXISTS basketball_fixtures (
  bsdEventId       INTEGER PRIMARY KEY,
  league           TEXT    NOT NULL,
  leagueBsdId      INTEGER NOT NULL,
  scheduledAt      TEXT    NOT NULL,
  status           TEXT    NOT NULL,
  homeKey          TEXT    NOT NULL,
  awayKey          TEXT    NOT NULL,
  homeName         TEXT    NOT NULL,
  awayName         TEXT    NOT NULL,
  homeScore        INTEGER,
  awayScore        INTEGER,
  probHome         REAL,
  probAway         REAL,
  eloHome          REAL,
  eloAway          REAL,
  confidence       TEXT,
  modelVersion     TEXT,
  mlOddsHome       REAL,
  mlOddsAway       REAL,
  mlFairHome       REAL,
  mlFairAway       REAL,
  mlVigPct         REAL,
  mlBooks          INTEGER,
  homeStanding     TEXT,
  awayStanding     TEXT,
  last10ScoredHome INTEGER,
  last10ScoredAway INTEGER,
  last10TotalHome  INTEGER,
  last10TotalAway  INTEGER,
  venue            TEXT,
  -- Lignes AH / OU (2026-10-08) : NULL EXPLICITE quand la source n'en livre
  -- pas. Jamais 0, jamais une ligne de repli — 0 se lirait comme une ligne
  -- de total « 0 point ».
  ahLine           REAL, ahBooks        INTEGER,
  ahFairFirst      REAL, ahFairSecond   REAL,
  ahVigPct         REAL, ahBestFirst    REAL, ahBestSecond   REAL,
  ouLine           REAL, ouBooks        INTEGER,
  ouFairFirst      REAL, ouFairSecond   REAL,
  ouVigPct         REAL, ouBestFirst    REAL, ouBestSecond   REAL,
  sourceFetchedAt  TEXT NOT NULL,
  updatedAt        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bbfx_league_date ON basketball_fixtures(league, scheduledAt);
CREATE INDEX IF NOT EXISTS idx_bbfx_status     ON basketball_fixtures(status);
`;

const COLS = [
  "bsdEventId", "league", "leagueBsdId", "scheduledAt", "status",
  "homeKey", "awayKey", "homeName", "awayName", "homeScore", "awayScore",
  "probHome", "probAway", "eloHome", "eloAway", "confidence", "modelVersion",
  "mlOddsHome", "mlOddsAway", "mlFairHome", "mlFairAway", "mlVigPct", "mlBooks",
  "homeStanding", "awayStanding", "last10ScoredHome", "last10ScoredAway",
  "last10TotalHome", "last10TotalAway", "venue",
  "ahLine", "ahBooks", "ahFairFirst", "ahFairSecond", "ahVigPct", "ahBestFirst", "ahBestSecond",
  "ouLine", "ouBooks", "ouFairFirst", "ouFairSecond", "ouVigPct", "ouBestFirst", "ouBestSecond",
  "sourceFetchedAt", "updatedAt",
] as const;

/** Type SQL par colonne — sert la migration `ALTER TABLE` ET l'insert. */
const SQL_TYPES: Record<(typeof COLS)[number], string> = {
  bsdEventId: "INTEGER PRIMARY KEY", league: "TEXT", leagueBsdId: "INTEGER",
  scheduledAt: "TEXT", status: "TEXT",
  homeKey: "TEXT", awayKey: "TEXT", homeName: "TEXT", awayName: "TEXT",
  homeScore: "INTEGER", awayScore: "INTEGER",
  probHome: "REAL", probAway: "REAL", eloHome: "REAL", eloAway: "REAL",
  confidence: "TEXT", modelVersion: "TEXT",
  mlOddsHome: "REAL", mlOddsAway: "REAL", mlFairHome: "REAL", mlFairAway: "REAL",
  mlVigPct: "REAL", mlBooks: "INTEGER",
  homeStanding: "TEXT", awayStanding: "TEXT",
  last10ScoredHome: "INTEGER", last10ScoredAway: "INTEGER",
  last10TotalHome: "INTEGER", last10TotalAway: "INTEGER",
  venue: "TEXT",
  ahLine: "REAL", ahBooks: "INTEGER", ahFairFirst: "REAL", ahFairSecond: "REAL",
  ahVigPct: "REAL", ahBestFirst: "REAL", ahBestSecond: "REAL",
  ouLine: "REAL", ouBooks: "INTEGER", ouFairFirst: "REAL", ouFairSecond: "REAL",
  ouVigPct: "REAL", ouBestFirst: "REAL", ouBestSecond: "REAL",
  sourceFetchedAt: "TEXT NOT NULL", updatedAt: "TEXT NOT NULL",
};

/**
 * Migration colonne par colonne.
 *
 * ⚠️ `CREATE TABLE IF NOT EXISTS` ne fait RIEN si la table existe déjà avec
 * un ancien schéma — il ne manque que `table has no column named ahLine`
 * à l'insertion, constaté le 2026-10-08. SQLite n'a pas de `IF NOT EXISTS`
 * sur `ADD COLUMN`, d'où la vérification par `PRAGMA table_info`.
 *
 * `PRIMARY KEY` non migrable (SQLite refuse l'ajout de PK après coup) : c'est
 * voulu, la clé n'a jamais changé.
 */
function migrateColumns(db: Db): { added: string[] } {
  const existing = new Set(
    (db.prepare("PRAGMA table_info(basketball_fixtures)").all() as Array<{ name: string }>)
      .map((c) => c.name),
  );
  const added: string[] = [];
  for (const col of COLS) {
    if (existing.has(col)) continue;
    // sourceFetchedAt / updatedAt portaient NOT NULL dans le DDL : SQLite
    // interdit un ALTER ADD NOT NULL sans valeur par défaut → on l'omet ici,
    // la contrainte reste portée par le DDL pour les tables neuves.
    const decl = SQL_TYPES[col].replace(/\s+NOT NULL$/, "");
    db.exec(`ALTER TABLE basketball_fixtures ADD COLUMN ${col} ${decl}`);
    added.push(col);
  }
  return { added };
}
function dbPath(): string | null {
  const cands = [
    process.env.DATABASE_PATH,
    path.join(process.cwd(), "pariscore.db"),
    path.join(process.cwd(), "..", "pariscore.db"),
  ].filter(Boolean) as string[];
  for (const c of cands) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* suivant */ }
  }
  return null;
}

type Db = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...p: unknown[]) => unknown;
    all: (...p: unknown[]) => unknown[];
  };
  close: () => void;
};

function open(): Db | null {
  const p = dbPath();
  if (!p) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as {
      Database: new (f: string, o?: object) => Db;
    };
    return new Database(p);
  } catch {
    return null;
  }
}

/** Crée la table si absente. Idempotent — `IF NOT EXISTS` sur tout. */
export function ensureBasketballFixtures(): boolean {
  const db = open();
  if (!db) return false;
  try {
    db.exec(BASKETBALL_FIXTURES_DDL);
    // Table déjà existante avec un ancien schéma → migration nécessaire.
    migrateColumns(db);
    return true;
  } catch {
    return false;
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

/**
 * Écriture idempotente : `INSERT ... ON CONFLICT(bsdEventId) DO UPDATE`.
 * Une seconde ingestion du même dump ne crée pas de doublon, elle rafraîchit.
 *
 * Refuse une ligne dont l'événement est absent — jamais de fixture fantôme.
 */
export function upsertBasketballFixtures(rows: BasketballFixtureRow[]): {
  written: number;
  skipped: number;
} {
  if (!rows.length) return { written: 0, skipped: 0 };
  const db = open();
  if (!db) return { written: 0, skipped: rows.length };
  try {
    db.exec(BASKETBALL_FIXTURES_DDL);
    migrateColumns(db);
    const placeholders = COLS.map(() => "?").join(", ");
    const updates = COLS.filter((c) => c !== "bsdEventId")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");
    const stmt = db.prepare(
      `INSERT INTO basketball_fixtures (${COLS.join(", ")}) VALUES (${placeholders})
       ON CONFLICT(bsdEventId) DO UPDATE SET ${updates}`,
    );

    let written = 0;
    let skipped = 0;
    for (const r of rows) {
      if (!r.bsdEventId || !r.homeKey || !r.awayKey) { skipped++; continue; }
      const vals = COLS.map((c) => (r as unknown as Record<string, unknown>)[c] ?? null);
      try {
        stmt.run(...vals);
        written++;
      } catch {
        skipped++;
      }
    }
    return { written, skipped };
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

/** Lecture — filtre sur ligue et/ou statut, trié par heure de coup d'envoi. */
export function loadBasketballFixtures(filter?: {
  league?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}): BasketballFixtureRow[] {
  const db = open();
  if (!db) return [];
  try {
    const conds: string[] = [];
    const args: unknown[] = [];
    if (filter?.league) { conds.push("league = ?"); args.push(filter.league); }
    if (filter?.status) { conds.push("status = ?"); args.push(filter.status); }
    if (filter?.from) { conds.push("scheduledAt >= ?"); args.push(filter.from); }
    if (filter?.to) { conds.push("scheduledAt <= ?"); args.push(filter.to); }
    const where = conds.length ? " WHERE " + conds.join(" AND ") : "";
    const limit = filter?.limit && filter.limit > 0 ? ` LIMIT ${Math.floor(filter.limit)}` : "";
    return db
      .prepare(`SELECT * FROM basketball_fixtures${where} ORDER BY scheduledAt ASC${limit}`)
      .all(...args) as BasketballFixtureRow[];
  } catch {
    return [];
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

/**
 * Synchronise un résultat FINAL depuis le cache — c'est la vérification
 * « Dubaï 58-77, Maccabi 97-79 » demandée par la mission.
 *
 * `null` sur un score = on ne publie pas de score partial : `status` porte
 * l'état, les colonnes restent à NULL plutôt que de valoir 0.
 */
export function applyBasketballResult(
  bsdEventId: number,
  status: string,
  homeScore: number | null,
  awayScore: number | null,
): boolean {
  const db = open();
  if (!db) return false;
  try {
    db.prepare(
      `UPDATE basketball_fixtures
          SET status = ?, homeScore = ?, awayScore = ?, updatedAt = ?
        WHERE bsdEventId = ?`,
    ).run(status, homeScore, awayScore, new Date().toISOString(), bsdEventId);
    return true;
  } catch {
    return false;
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

/**
 * Opportunités : EV > 0 strictement (règle P4), sur ligues calibrées UNIQUEMENT.
 *
 * `basketCalibration` est le garde : une ligue non mesurée ne peut pas produire
 * de valeur, faute de σ de référence.
 */
export type Opportunity = {
  bsdEventId: number;
  league: string;
  matchup: string;
  side: "home" | "away";
  prob: number;
  odds: number;
  ev: number;
  edge: number;
  disagreementPp: number;
  /** true = écart modèle/cote très élevé → à instruire, PAS à parier. */
  strongDisagreement: boolean;
};

export const STRONG_DISAGREEMENT_PP = 12;

export function basketballOpportunities(): Opportunity[] {
  const rows = loadBasketballFixtures({ limit: 500 });
  const out: Opportunity[] = [];
  for (const r of rows) {
    // Garde 1 : ligue calibrée (sinon aucun σ, donc aucun jugement possible)
    if (!basketCalibration(r.league)) continue;
    // Garde 2 : prédiction réellement publiée
    if (r.probHome == null || r.probAway == null) continue;
    // Garde 3 : cotes exploitables
    if (!r.mlOddsHome || !r.mlOddsAway || r.mlOddsHome <= 1 || r.mlOddsAway <= 1) continue;

    const cands: Array<[ "home" | "away", number, number ]> = [
      ["home", r.probHome, r.mlOddsHome],
      ["away", r.probAway, r.mlOddsAway],
    ];
    for (const [side, prob, odds] of cands) {
      const ev = prob * odds - 1;
      if (ev <= 0) continue;
      const fair = 1 / odds;
      const disagreement = Math.abs(prob - fair) * 100;
      out.push({
        bsdEventId: r.bsdEventId,
        league: r.league,
        matchup: `${r.homeName} — ${r.awayName}`,
        side,
        prob,
        odds,
        ev,
        edge: (prob - fair) * 100,
        disagreementPp: disagreement,
        strongDisagreement: disagreement > STRONG_DISAGREEMENT_PP,
      });
    }
  }
  // Tri par EV décroissant — la valeur la plus forte d'abord.
  return out.sort((a, b) => b.ev - a.ev);
}
