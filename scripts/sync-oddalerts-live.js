#!/usr/bin/env node
'use strict';
/**
 * sync-oddalerts-live.js
 * ----------------------
 * Synchronise les live odds OddAlerts vers pariscore.db (table live_odds_oddalerts).
 *
 * Source : https://data.oddalerts.com/latency/games + /latency/game/{smid}
 * Polling : toutes les 30s pendant les heures de match (cron VPS ou worker PM2).
 *
 * Usage :
 *   node scripts/sync-oddalerts-live.js              # run once (pour test)
 *   node scripts/sync-oddalerts-live.js --daemon     # boucle infinie 30s
 *   node scripts/sync-oddalerts-live.js --once       # run once explicite
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://data.oddalerts.com/latency';
const POLL_INTERVAL_MS = 30000; // 30s
const HTTP_TIMEOUT_MS = 15000;

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DB_PATH = process.env.DATABASE_PATH || path.join(REPO_DIR, 'pariscore.db');

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}
const DAEMON = !!args.daemon;
const ONCE = !!args.once || !DAEMON;

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, timeout: HTTP_TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        res.resume();
        return resolve(fetchJson(new URL(res.headers.location, url).href));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// ─── DB ───────────────────────────────────────────────────────────────────────
let db = null;
function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  // Créer la table si elle n'existe pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_odds_oddalerts (
      id TEXT PRIMARY KEY,
      smid INTEGER NOT NULL,
      matchId TEXT,
      marketTitle TEXT NOT NULL,
      marketName TEXT NOT NULL,
      marketType TEXT NOT NULL,
      oddsJson TEXT NOT NULL,
      bookmakerId INTEGER NOT NULL,
      marketId INTEGER,
      dataAgeSeconds INTEGER,
      oddsAgeSeconds INTEGER,
      serverTime INTEGER NOT NULL,
      oddsUpdatedAt INTEGER,
      gameStatus TEXT,
      elapsed INTEGER,
      homeGoals INTEGER,
      awayGoals INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(smid, marketTitle, bookmakerId)
    );
    CREATE INDEX IF NOT EXISTS idx_live_odds_oddalerts_smid ON live_odds_oddalerts(smid);
    CREATE INDEX IF NOT EXISTS idx_live_odds_oddalerts_matchId ON live_odds_oddalerts(matchId);
  `);
  return db;
}

function generateId() {
  return 'oa_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function upsertLiveOdds(rows) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO live_odds_oddalerts (
      id, smid, matchId, marketTitle, marketName, marketType, oddsJson,
      bookmakerId, marketId, dataAgeSeconds, oddsAgeSeconds, serverTime,
      oddsUpdatedAt, gameStatus, elapsed, homeGoals, awayGoals, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(smid, marketTitle, bookmakerId) DO UPDATE SET
      oddsJson = excluded.oddsJson,
      marketName = excluded.marketName,
      marketType = excluded.marketType,
      marketId = excluded.marketId,
      dataAgeSeconds = excluded.dataAgeSeconds,
      oddsAgeSeconds = excluded.oddsAgeSeconds,
      serverTime = excluded.serverTime,
      oddsUpdatedAt = excluded.oddsUpdatedAt,
      gameStatus = excluded.gameStatus,
      elapsed = excluded.elapsed,
      homeGoals = excluded.homeGoals,
      awayGoals = excluded.awayGoals,
      updatedAt = datetime('now')
  `);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(r);
  });
  insertMany(rows);
  return rows.length;
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────
async function syncOnce() {
  console.log(`[${new Date().toISOString()}] Sync OddAlerts live odds...`);

  // 1. Récupérer la liste des matchs live
  let gamesResp;
  try {
    gamesResp = await fetchJson(`${BASE_URL}/games`);
  } catch (err) {
    console.error('Erreur fetch /games:', err.message);
    return { ok: false, error: err.message };
  }

  const games = gamesResp.games || [];
  console.log(`  ${games.length} match(s) live`);

  if (games.length === 0) {
    console.log('  Aucun match live, fin.');
    return { ok: true, games: 0, markets: 0 };
  }

  let totalMarkets = 0;

  // 2. Pour chaque match, récupérer les détails + odds
  for (const g of games) {
    const smid = g.smid;
    try {
      const detail = await fetchJson(`${BASE_URL}/game/${smid}`);
      const game = detail.game;
      const liveOdds = detail.live_odds || [];
      const serverTime = detail.server_time;
      const dataAge = detail.data_age_seconds;
      const oddsAge = detail.odds_age_seconds;
      const oddsUpdatedAt = detail.odds_updated_at;

      if (liveOdds.length === 0) {
        console.log(`  ${game.home_name} vs ${game.away_name} (${smid}) - pas de live odds`);
        continue;
      }

      const rows = liveOdds.map((m) => [
        generateId(),
        smid,
        detail.game.id ? String(detail.game.id) : null, // BSD event ID
        m.title,
        m.name,
        m.type,
        JSON.stringify(m.odds),
        m.bookmaker_id,
        m.id || null,
        dataAge,
        oddsAge,
        serverTime,
        oddsUpdatedAt,
        game.status,
        game.elapsed,
        game.home_goals,
        game.away_goals,
      ]);

      const inserted = upsertLiveOdds(rows);
      totalMarkets += inserted;
      console.log(`  ${game.home_name} vs ${game.away_name} (${smid}) - ${inserted} marché(s) upsert`);
    } catch (err) {
      console.error(`  Erreur match ${smid}:`, err.message);
    }
  }

  console.log(`  Total: ${games.length} matchs, ${totalMarkets} marchés upsert`);
  return { ok: true, games: games.length, markets: totalMarkets };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (DAEMON) {
    console.log(`Démarrage daemon OddAlerts live sync (poll ${POLL_INTERVAL_MS / 1000}s)...`);
    while (true) {
      await syncOnce();
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  } else {
    const result = await syncOnce();
    console.log('Résultat:', result);
    process.exit(result.ok ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});