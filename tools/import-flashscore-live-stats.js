#!/usr/bin/env node
/**
 * bd qm6a Plan E — Flashscore live stats fallback (ESPN-only matchs)
 *
 * Ingest live statistics + score state depuis dataset Apify Flashscore live-matches
 * → INSERT INTO api_cache (key='flashscore_live_stats_<normHome>_<normAway>')
 * source='flashscore_live_stats' TTL 30min (données live, courte fraîcheur).
 *
 * Compresse statistics: extrait Top stats catégorie période=Match (possession, total shots,
 * shots on target, corners) + score + minute + period. Map stat_name → live_* champs serveur.
 *
 * Idempotent : skip si entrée non-expirée même source (sauf --force).
 *
 * USAGE:
 *   node tools/import-flashscore-live-stats.js [--dry-run] [--force]
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 30 * 60 * 1000;
const SOURCE = 'flashscore_live_stats';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function normKey(name) {
  if (!name) return '';
  return String(name).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/\s+/g, '_');
}

function findDatasets() {
  return fs.readdirSync(ROOT)
    .filter(f => /^dataset_flashscore-live-matches_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

// Map Flashscore stat_name (EN) → champs PariScore conventionnels
const STAT_MAP = {
  'Ball possession': 'possession_pct',
  'Total shots': 'total_shots',
  'Shots on target': 'shots_on_target',
  'Shots off target': 'shots_off_target',
  'Corner kicks': 'corner_kicks',
  'Fouls': 'fouls',
  'Yellow cards': 'yellow_cards',
  'Red cards': 'red_cards',
  'Offsides': 'offsides',
  'Throw-ins': 'throw_ins',
  'Goal kicks': 'goal_kicks',
  'Free kicks': 'free_kicks',
  'Tackles': 'tackles',
  'Saves': 'saves',
};

function parseStatValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-') return null;
  const pctMatch = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) return Number(pctMatch[1]);
  const num = Number(s);
  if (!isNaN(num)) return num;
  return s;
}

function loadEntries(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const m of data) {
    if (!m || !m.home_team || !m.away_team) continue;
    if (m.match_url && !m.match_url.includes('/football/')) continue;
    const matchStats = Array.isArray(m.statistics)
      ? m.statistics.filter(s => s && s.period === 'Match' && s.category === 'Top stats')
      : [];
    const home_stats = {};
    const away_stats = {};
    for (const s of matchStats) {
      const key = STAT_MAP[s.stat_name];
      if (!key) continue;
      home_stats[key] = parseStatValue(s.home_value);
      away_stats[key] = parseStatValue(s.away_value);
    }
    out.push({
      home_team: m.home_team,
      away_team: m.away_team,
      flashscore_match_id: m.match_id,
      status: m.status,
      match_minute: m.match_minute,
      match_period: m.match_period,
      home_score: m.home_score,
      away_score: m.away_score,
      home_score_halftime: m.home_score_halftime,
      away_score_halftime: m.away_score_halftime,
      home_stats,
      away_stats,
      lineups_confirmed: !!m.lineups_confirmed,
      home_formation: m.lineups && m.lineups.home_formation || null,
      away_formation: m.lineups && m.lineups.away_formation || null,
      scraped_at: m.scraped_at || null,
    });
  }
  return out;
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Flashscore-live-stats] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Flashscore-live-stats] ${datasets.length} dataset(s) found:`);
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
        const key = `flashscore_live_stats_${h}_${a}`;
        if (dupes.has(key)) continue;
        dupes.add(key);

        if (db && !FORCE) {
          const existing = getStmt.get(key);
          if (existing && existing.expires_at > now && existing.source === SOURCE) {
            skipped++;
            continue;
          }
        }

        if (DRY_RUN) {
          const stats = Object.keys(e.home_stats).length;
          console.log(`    [DRY] would write ${key} (${e.home_team} ${e.home_score}-${e.away_score} ${e.away_team}, min ${e.match_minute}, ${stats} stats)`);
        } else {
          setStmt.run(key, JSON.stringify(e), SOURCE, now, expires);
        }
        written++;
      }
    }

    console.log(`  [Flashscore-live-stats] total entries=${total} unique=${dupes.size} written=${written} skipped=${skipped}`);
    if (DRY_RUN) console.log('  [Flashscore-live-stats] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Flashscore-live-stats] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normKey, STAT_MAP, parseStatValue };
