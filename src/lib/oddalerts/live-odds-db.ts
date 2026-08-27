// Accès DB pour live_odds_oddalerts (pariscore.db, lecture seule).
// Même pattern que src/lib/leagues-stats/db.ts

import path from "node:path";
import type { OddAlertsLiveOddsMarket, OddAlertsLiveOddsParsed, OddAlertsLiveGameSummary } from "./live-odds-types";

type BSD = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[]; get: (...params: unknown[]) => unknown };
  close: () => void;
};

const SQLITE_FILE = process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

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
        `[oddalerts-live-odds] pariscore.db non lisible (${SQLITE_FILE}) — live odds désactivées. Détail: ${(err as Error).message}`
      );
    }
    return null;
  }
}

function rowToMarket(row: Record<string, unknown>): OddAlertsLiveOddsParsed {
  return {
    id: String(row.id),
    smid: Number(row.smid),
    matchId: (row.matchId as string) || null,
    marketTitle: String(row.marketTitle),
    marketName: String(row.marketName),
    marketType: String(row.marketType) as 'basic' | 'grid',
    oddsJson: String(row.oddsJson),
    odds: JSON.parse(String(row.oddsJson)) as Record<string, number>,
    bookmakerId: Number(row.bookmakerId),
    marketId: row.marketId ? Number(row.marketId) : null,
    dataAgeSeconds: row.dataAgeSeconds ? Number(row.dataAgeSeconds) : null,
    oddsAgeSeconds: row.oddsAgeSeconds ? Number(row.oddsAgeSeconds) : null,
    serverTime: Number(row.serverTime),
    oddsUpdatedAt: row.oddsUpdatedAt ? Number(row.oddsUpdatedAt) : null,
    gameStatus: (row.gameStatus as string) || null,
    elapsed: row.elapsed ? Number(row.elapsed) : null,
    homeGoals: row.homeGoals ? Number(row.homeGoals) : null,
    awayGoals: row.awayGoals ? Number(row.awayGoals) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

/** Récupère tous les marchés live odds pour un SMID donné */
export function getLiveOddsBySmid(smid: number): OddAlertsLiveOddsParsed[] {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT * FROM live_odds_oddalerts WHERE smid = ? ORDER BY marketTitle ASC`
    )
    .all(smid) as Record<string, unknown>[];
  return rows.map(rowToMarket);
}

/** Récupère le résumé complet d'un match live (infos match + tous ses marchés) */
export function getLiveGameSummary(smid: number): OddAlertsLiveGameSummary | null {
  const db = getDb();
  if (!db) return null;

  const row = db
    .prepare(
      `SELECT smid, matchId, gameStatus, elapsed, homeGoals, awayGoals,
              dataAgeSeconds, oddsAgeSeconds, serverTime, oddsUpdatedAt
       FROM live_odds_oddalerts WHERE smid = ? LIMIT 1`
    )
    .get(smid) as Record<string, unknown> | undefined;

  if (!row) return null;

  const markets = getLiveOddsBySmid(smid);
  const homeName = markets.find(m => m.marketTitle === 'ft_result')?.oddsJson || '';
  // On n'a pas les noms d'équipe dans cette table, ils viennent de l'API /games
  // Pour l'instant on utilise des placeholders
  return {
    smid: Number(row.smid),
    matchId: (row.matchId as string) || null,
    homeName: '', // À compléter via API /games
    awayName: '',
    homeGoals: row.homeGoals ? Number(row.homeGoals) : null,
    awayGoals: row.awayGoals ? Number(row.awayGoals) : null,
    elapsed: row.elapsed ? Number(row.elapsed) : null,
    status: (row.gameStatus as string) || null,
    markets,
    dataAgeSeconds: row.dataAgeSeconds ? Number(row.dataAgeSeconds) : null,
    oddsAgeSeconds: row.oddsAgeSeconds ? Number(row.oddsAgeSeconds) : null,
    serverTime: Number(row.serverTime),
    oddsUpdatedAt: row.oddsUpdatedAt ? Number(row.oddsUpdatedAt) : null,
  };
}

/** Récupère tous les SMIDs ayant des live odds (pour liste) */
export function getLiveOddsSmids(): number[] {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare(`SELECT DISTINCT smid FROM live_odds_oddalerts ORDER BY smid DESC`)
    .all() as { smid: number }[];
  return rows.map(r => r.smid);
}

/** Récupère les infos de base (équipes, score, minute) pour plusieurs SMIDs */
export function getLiveGamesBasicInfo(smids: number[]): Map<number, { homeName: string; awayName: string; homeGoals: number | null; awayGoals: number | null; elapsed: number | null; status: string | null }> {
  const db = getDb();
  if (!db || smids.length === 0) return new Map();

  const placeholders = smids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT smid, gameStatus, elapsed, homeGoals, awayGoals FROM live_odds_oddalerts WHERE smid IN (${placeholders}) GROUP BY smid`
    )
    .all(...smids) as Record<string, unknown>[];

  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.smid), {
      homeName: '', // Sera complété par l'API /games
      awayName: '',
      homeGoals: row.homeGoals ? Number(row.homeGoals) : null,
      awayGoals: row.awayGoals ? Number(row.awayGoals) : null,
      elapsed: row.elapsed ? Number(row.elapsed) : null,
      status: (row.gameStatus as string) || null,
    });
  }
  return map;
}