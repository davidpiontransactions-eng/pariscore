#!/usr/bin/env node
/**
 * bd qm6a Plan B — Standings fallback offline (Flashscore datasets)
 *
 * Ingest standings rows depuis dataset Apify Flashscore team-stats
 * → INSERT INTO api_cache (key='flashscore_standings_<configId>') source='flashscore_standings' TTL 7j.
 *
 * Trigger fallback côté server.js : si BSD+ESPN+API-Football tous HS pour une ligue donnée,
 * la route /api/v1/standings/:leagueId injecte ces rows en dernier recours.
 *
 * Idempotent : skip si entrée non-expirée même source (sauf --force).
 * Sport football uniquement (drop NBA/autres).
 *
 * USAGE:
 *   node tools/import-flashscore-standings.js [--dry-run] [--force]
 *
 * Datasets auto-detect racine projet : dataset_flashscore-team-stats_*.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SOURCE = 'flashscore_standings';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function normText(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDatasets() {
  return fs.readdirSync(ROOT)
    .filter(f => /^dataset_flashscore-team-stats_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

function loadLeaguesConfig() {
  const file = path.join(ROOT, 'leagues_config.json');
  if (!fs.existsSync(file)) return [];
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(cfg.leagues) ? cfg.leagues : [];
  } catch (_) { return []; }
}

// Map Flashscore (country, league) → config_id via leagues_config.json
function resolveConfigId(countryName, leagueName, leaguesConfig) {
  const c = normText(countryName);
  const l = normText(leagueName);
  for (const lg of leaguesConfig) {
    if (normText(lg.country) === c && normText(lg.name) === l) return lg.id;
  }
  return null;
}

function loadEntries(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data.filter(r => r && r.sport_name === 'football'
    && r.team_name && r.standing_position != null);
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Flashscore-standings] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Flashscore-standings] ${datasets.length} dataset(s) found:`);
  datasets.forEach(d => console.log('    -', path.basename(d)));

  const leaguesConfig = loadLeaguesConfig();
  if (!leaguesConfig.length) {
    console.warn('  [Flashscore-standings] leagues_config.json vide/absent — abort.');
    process.exit(1);
  }

  const db = DRY_RUN ? null : new Database(DB_PATH);
  try {
    if (db) db.pragma('journal_mode = WAL');
    const getStmt = db ? db.prepare('SELECT source, expires_at FROM api_cache WHERE key = ?') : null;
    const setStmt = db ? db.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)') : null;

    // Regrouper rows par (country, league) avant write — 1 entrée cache par ligue
    const byLeague = new Map();
    let totalRows = 0;
    for (const file of datasets) {
      const entries = loadEntries(file);
      totalRows += entries.length;
      for (const e of entries) {
        const lk = `${e.country_name}|${e.league_name}`;
        if (!byLeague.has(lk)) byLeague.set(lk, []);
        byLeague.get(lk).push({
          rank: e.standing_position,
          team: e.team_name,
          team_id: e.team_id || null,
          team_slug: e.team_slug || null,
          team_logo_url: e.team_logo_url || null,
          played: e.matches_played || 0,
          wins: e.wins || 0,
          draws: e.draws || 0,
          losses: e.losses || 0,
          pts: e.points || 0,
          gf: e.goals_for || 0,
          ga: e.goals_against || 0,
          gd: e.goal_difference || 0,
        });
      }
    }

    const now = Date.now();
    const expires = now + TTL_MS;
    let written = 0, skipped = 0, unmapped = 0;

    for (const [lk, rows] of byLeague) {
      const [country, league] = lk.split('|');
      const configId = resolveConfigId(country, league, leaguesConfig);
      if (!configId) {
        console.warn(`  [Flashscore-standings] UNMAPPED league ${lk} (${rows.length} rows) — skip`);
        unmapped++;
        continue;
      }

      rows.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      const key = `flashscore_standings_${configId}`;
      const data = {
        configId,
        country,
        league,
        rows,
        captured_at: now,
      };

      if (db && !FORCE) {
        const existing = getStmt.get(key);
        if (existing && existing.expires_at > now && existing.source === SOURCE) {
          skipped++;
          continue;
        }
      }

      if (DRY_RUN) {
        console.log(`    [DRY] would write ${key} (configId=${configId} country=${country} league=${league} rows=${rows.length})`);
      } else {
        setStmt.run(key, JSON.stringify(data), SOURCE, now, expires);
        console.log(`    [WRITE] ${key} configId=${configId} ${country}|${league} rows=${rows.length}`);
      }
      written++;
    }

    console.log(`  [Flashscore-standings] totalRows=${totalRows} leagues=${byLeague.size} written=${written} skipped=${skipped} unmapped=${unmapped}`);
    if (DRY_RUN) console.log('  [Flashscore-standings] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Flashscore-standings] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normText, resolveConfigId };
