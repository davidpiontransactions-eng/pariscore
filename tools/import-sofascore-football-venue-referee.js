#!/usr/bin/env node
/**
 * bd qm6a Plan D — Venue + referee enrichment (alt bd 82th BSD Phase 4)
 *
 * Ingest venue + referee depuis dataset Apify sofascore-scraper-pro (entries football match)
 * → INSERT INTO api_cache (key='sofa_venue_referee_<normHome>_<normAway>')
 * source='sofascore_venue_referee' TTL 7j.
 *
 * Idempotent : skip si entrée non-expirée même source (sauf --force).
 *
 * USAGE:
 *   node tools/import-sofascore-football-venue-referee.js [--dry-run] [--force]
 *
 * Datasets auto-detect racine projet : dataset_sofascore-scraper-pro_*.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SOURCE = 'sofascore_venue_referee';

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
    .filter(f => /^dataset_sofascore-scraper-pro_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

function loadEntries(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const r of data) {
    if (!r || !r.url || !r.data) continue;
    if (!r.url.includes('/football/match/')) continue;
    const ev = r.data.event;
    if (!ev || !ev.homeTeam || !ev.awayTeam) continue;
    const venueRaw = ev.venue;
    const refRaw = ev.referee;
    if (!venueRaw && !refRaw) continue;
    const venue = venueRaw ? {
      name: venueRaw.name,
      capacity: venueRaw.capacity,
      city: venueRaw.city && venueRaw.city.name,
      country: venueRaw.country && venueRaw.country.name,
      country_code: venueRaw.country && venueRaw.country.alpha2,
      coords: venueRaw.venueCoordinates || null,
    } : null;
    const referee = refRaw ? {
      name: refRaw.name,
      country: refRaw.country && refRaw.country.name,
      country_code: refRaw.country && refRaw.country.alpha2,
      games: refRaw.games,
      yellow_cards: refRaw.yellowCards,
      red_cards: refRaw.redCards,
      yellow_red_cards: refRaw.yellowRedCards,
      yc_per_game: refRaw.games ? Math.round((refRaw.yellowCards / refRaw.games) * 100) / 100 : null,
      rc_per_game: refRaw.games ? Math.round((refRaw.redCards / refRaw.games) * 1000) / 1000 : null,
    } : null;
    out.push({
      home_team: ev.homeTeam.name,
      away_team: ev.awayTeam.name,
      sofa_event_id: ev.id,
      venue,
      referee,
    });
  }
  return out;
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Sofa-venue-referee] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Sofa-venue-referee] ${datasets.length} dataset(s) found:`);
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
        const key = `sofa_venue_referee_${h}_${a}`;
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
          console.log(`    [DRY] would write ${key} (${e.home_team} vs ${e.away_team}) venue=${e.venue?.name||'-'} ref=${e.referee?.name||'-'}`);
        } else {
          setStmt.run(key, JSON.stringify(e), SOURCE, now, expires);
        }
        written++;
      }
    }

    console.log(`  [Sofa-venue-referee] total entries=${total} unique=${dupes.size} written=${written} skipped=${skipped}`);
    if (DRY_RUN) console.log('  [Sofa-venue-referee] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Sofa-venue-referee] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normKey };
