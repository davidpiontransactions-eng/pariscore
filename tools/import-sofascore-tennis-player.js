#!/usr/bin/env node
/**
 * bd 6jro Plan G — Sofascore tennis player profile enrichment
 *
 * Ingest rankings + grandSlamBestResults + best ranking + country depuis dataset Apify
 * sofascore-scraper-pro (entries tennis player profile URL pattern /tennis/player/...).
 * → INSERT INTO api_cache (key='sofa_tennis_player_<normName>') source='sofascore_tennis_player' TTL 7j.
 *
 * Idempotent : skip si entrée non-expirée même source (sauf --force).
 *
 * USAGE:
 *   node tools/import-sofascore-tennis-player.js [--dry-run] [--force]
 *
 * Datasets auto-detect racine projet : dataset_sofascore-scraper-pro_*.json
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SOURCE = 'sofascore_tennis_player';

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
    if (!r.url.includes('/tennis/player/')) continue;
    const td = r.data.teamDetails;
    if (!td || !td.name) continue;
    // Extract minimal rankings : array of {ranking, points, type, tournamentsPlayed, bestRanking, bestRankingDate}
    const rankingsRaw = (r.data.teamRankings && Array.isArray(r.data.teamRankings.rankings))
      ? r.data.teamRankings.rankings : [];
    const rankings = rankingsRaw
      .filter(rk => rk && rk.team && rk.team.id === td.id)
      .map(rk => ({
        type: rk.type,
        ranking: rk.ranking,
        points: rk.points,
        previousRanking: rk.previousRanking,
        bestRanking: rk.bestRanking,
        tournamentsPlayed: rk.tournamentsPlayed,
        rowName: rk.rowName,
        bestRankingDateTimestamp: rk.bestRankingDateTimestamp,
      }));
    // Grand Slam best results : compress to title count + last 5 years per tournament
    const gsRaw = (r.data.teamGrandSlamBestResults && Array.isArray(r.data.teamGrandSlamBestResults.results))
      ? r.data.teamGrandSlamBestResults.results : [];
    const grandSlams = gsRaw.map(t => {
      const years = Array.isArray(t.years) ? t.years : [];
      const titles = years.filter(y => y.winner).length;
      const recent = years.slice(-6).map(y => ({
        year: y.year,
        round: y.round || null,
        winner: !!y.winner,
        isLive: !!y.isLive,
        isUpcoming: !!y.isUpcoming,
      }));
      return { id: t.id, name: t.name, titles, recent };
    });
    out.push({
      name: td.name,
      slug: td.slug,
      shortName: td.shortName,
      gender: td.gender,
      country: td.country,
      sofa_id: td.id,
      hasSingles: !!r.data.hasSingles,
      hasDoubles: !!r.data.hasDoubles,
      rankings,
      grandSlams,
    });
  }
  return out;
}

function run() {
  const datasets = findDatasets();
  if (datasets.length === 0) {
    console.log('  [Sofa-tennis-player] Aucun dataset trouvé racine projet.');
    process.exit(0);
  }
  console.log(`  [Sofa-tennis-player] ${datasets.length} dataset(s) found:`);
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
        const nk = normKey(e.name);
        if (!nk) continue;
        const key = `sofa_tennis_player_${nk}`;
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
          console.log(`    [DRY] would write ${key} (${e.name}) — rankings=${e.rankings.length} GS=${e.grandSlams.length}`);
        } else {
          setStmt.run(key, JSON.stringify(e), SOURCE, now, expires);
        }
        written++;
      }
    }

    console.log(`  [Sofa-tennis-player] total entries=${total} unique=${dupes.size} written=${written} skipped=${skipped}`);
    if (DRY_RUN) console.log('  [Sofa-tennis-player] DRY RUN — aucun write effectué.');
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  try {
    run();
  } catch (e) {
    console.error('  [Sofa-tennis-player] ERR:', e.message);
    process.exit(1);
  }
}

module.exports = { normKey };
