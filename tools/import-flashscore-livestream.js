#!/usr/bin/env node
/**
 * bd qm6a Plan F — has_live_stream badge UI tableau matchs (Flashscore datasets)
 *
 * Ingest has_live_stream flag depuis dataset Apify Flashscore live-matches
 * → INSERT INTO api_cache (key='livestream_<normHome>_<normAway>') source='flashscore_livestream' TTL 7j.
 *
 * Idempotent : skip si entrée non-expirée même source (sauf --force).
 * Sport football uniquement (drop autres).
 *
 * USAGE:
 *   node tools/import-flashscore-livestream.js [--dry-run] [--force]
 *
 * Datasets auto-detect racine projet : dataset_flashscore-live-matches_*.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours (dataset one-shot, value courte)
const SOURCE = 'flashscore_livestream';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Aligné server.js normName (line 4920) — lower + NFD strip + non-alnum→space + trim
// Puis space → '_' pour clé (aligné convention logo_ : line 21142 server.js).
function normKey(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

function findDatasets() {
  return fs.readdirSync(ROOT)
    .filter(f => /^dataset_flashscore-live-matches_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

function loadEntries(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && r.has_live_stream === true && r.home_team && r.away_team)
    .filter(r => !r.match_url || r.match_url.includes('/football/'))
    .map(r => ({
      home_team: r.home_team,
      away_team: r.away_team,
      league: r.league || null,
      match_id: r.match_id || null,
      match_url: r.match_url || null,
    }));
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Flashscore-livestream] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Flashscore-livestream] ${datasets.length} dataset(s) found:`);
  datasets.forEach(d => console.log('    -', path.basename(d)));

  const db = DRY_RUN ? null : new Database(DB_PATH);
  try {
    if (db) db.pragma('journal_mode = WAL');
    const getStmt = db ? db.prepare('SELECT source, expires_at FROM api_cache WHERE key = ?') : null;
    const setStmt = db ? db.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)') : null;

    let total = 0, written = 0, skipped = 0, dupes = new Set();
    const now = Date.now();
    const expires = now + TTL_MS;

    for (const file of datasets) {
      const entries = loadEntries(file);
      total += entries.length;
      for (const e of entries) {
        const h = normKey(e.home_team);
        const a = normKey(e.away_team);
        if (!h || !a) continue;
        const key = `livestream_${h}_${a}`;
        if (dupes.has(key)) continue;
        dupes.add(key);

        const data = {
          has_live_stream: true,
          home_team: e.home_team,
          away_team: e.away_team,
          league: e.league,
          flashscore_match_id: e.match_id,
        };

        if (db && !FORCE) {
          const existing = getStmt.get(key);
          if (existing && existing.expires_at > now && existing.source === SOURCE) {
            skipped++;
            continue;
          }
        }

        if (DRY_RUN) {
          console.log(`    [DRY] would write ${key} (${e.home_team} vs ${e.away_team})`);
        } else {
          setStmt.run(key, JSON.stringify(data), SOURCE, now, expires);
        }
        written++;
      }
    }

    console.log(`  [Flashscore-livestream] total entries=${total} unique=${dupes.size} written=${written} skipped=${skipped}`);
    if (DRY_RUN) console.log('  [Flashscore-livestream] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Flashscore-livestream] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normKey };
