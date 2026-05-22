#!/usr/bin/env node
/**
 * bd qm6a Plan A — Logos backup Flashscore datasets → api_cache
 *
 * Ingest team_logo_url depuis dataset Apify Flashscore team-stats
 * → INSERT INTO api_cache (key='logo_<normName>') avec source='flashscore' TTL 90j.
 *
 * Idempotent : skip si entrée existante non-expirée du même source ou plus récente.
 * Filter sport='football' uniquement (drop NBA et autres hors scope).
 *
 * USAGE:
 *   node tools/import-flashscore-logos.js [--dry-run] [--force]
 *
 * --dry-run : log sans INSERT
 * --force   : overwrite entrées existantes même non-expirées
 *
 * Datasets supportés (auto-detect racine projet):
 *   dataset_flashscore-team-stats_*.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours
const SOURCE = 'flashscore';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// normName aligné avec server.js — minuscules + sans accents + sans non-alphanum
function normName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

function findDatasets() {
  return fs.readdirSync(ROOT)
    .filter(f => /^dataset_flashscore-team-stats_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

function loadEntries(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && r.sport_name === 'football' && r.team_name && r.team_logo_url)
    .map(r => ({
      team_name: r.team_name,
      team_id_flashscore: r.team_id,
      team_logo_url: r.team_logo_url,
      league: r.league_name,
      country: r.country_name,
    }));
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Flashscore-logos] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Flashscore-logos] ${datasets.length} dataset(s) found:`);
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
        const key = 'logo_' + normName(e.team_name);
        if (dupes.has(key)) continue;
        dupes.add(key);

        const data = {
          url: e.team_logo_url,
          flashscoreId: e.team_id_flashscore,
          team_name: e.team_name,
          league: e.league,
          country: e.country,
        };

        if (db && !FORCE) {
          const existing = getStmt.get(key);
          if (existing && existing.expires_at > now && existing.source !== SOURCE) {
            skipped++;
            continue;
          }
        }

        if (DRY_RUN) {
          console.log(`    [DRY] would write ${key} → ${e.team_logo_url}`);
        } else {
          setStmt.run(key, JSON.stringify(data), SOURCE, now, expires);
        }
        written++;
      }
    }

    console.log(`  [Flashscore-logos] total entries=${total} unique=${dupes.size} written=${written} skipped=${skipped}`);
    if (DRY_RUN) console.log('  [Flashscore-logos] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Flashscore-logos] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normName };
