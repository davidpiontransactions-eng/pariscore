#!/usr/bin/env node
/**
 * bd 8uoc Phase 1 — Backup tennis_matches Sackmann table pré-purge (audit trail légal).
 *
 * Dump complet table tennis_matches (Sackmann CC BY-NC-SA) vers
 * archives/tennis_matches_sackmann_pre_purge_<timestamp>.json.gz avant DROP TABLE
 * exécuté par script séparé après validation.
 *
 * Préserve : schema, row counts par tour, full rows, hash SHA-256 du JSON brut.
 *
 * USAGE:
 *   node tools/backup-tennis-matches.js [--dry-run] [--out=<path>]
 *
 * EXIT CODES:
 *   0 = backup OK
 *   1 = table absente (rien à backup)
 *   2 = erreur I/O ou SQLite
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const ARCHIVE_DIR = path.join(ROOT, 'archives');

const DRY_RUN = process.argv.includes('--dry-run');
const outArg = process.argv.find(a => a.startsWith('--out='));
const OUT_OVERRIDE = outArg ? outArg.split('=')[1] : null;

function tsTag() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[backup] DB introuvable: ${DB_PATH}`);
    process.exit(2);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const hasTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='tennis_matches'`).get();
  if (!hasTable) {
    console.error(`[backup] table tennis_matches absente — rien à backup.`);
    process.exit(1);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM tennis_matches`).get().n;
  const byTour = db.prepare(`SELECT tour, COUNT(*) AS n, MIN(tourney_date) AS dmin, MAX(tourney_date) AS dmax FROM tennis_matches GROUP BY tour`).all();
  const rows = db.prepare(`SELECT * FROM tennis_matches ORDER BY tour, tourney_date, match_num`).all();
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tennis_matches'`).get().sql;
  const indexes = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='tennis_matches' AND sql IS NOT NULL`).all();

  db.close();

  const payload = {
    backup_version: 1,
    source: 'sackmann_cc_by_nc_sa',
    license_finding: 'CC BY-NC-SA 4.0 incompatible commercial — purge mandatory',
    decision_bd: '8uoc',
    decision_date: '2026-05-23',
    backup_created_at: new Date().toISOString(),
    db_path: DB_PATH,
    schema,
    indexes,
    summary: { total_rows: total, by_tour: byTour },
    rows
  };

  const json = JSON.stringify(payload);
  const sha = crypto.createHash('sha256').update(json).digest('hex');

  if (DRY_RUN) {
    console.log(`[backup] DRY-RUN — would write:`);
    console.log(`  total rows: ${total}`);
    console.log(`  by tour:    ${JSON.stringify(byTour)}`);
    console.log(`  sha256:     ${sha}`);
    console.log(`  raw bytes:  ${json.length}`);
    process.exit(0);
  }

  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const outPath = OUT_OVERRIDE || path.join(ARCHIVE_DIR, `tennis_matches_sackmann_pre_purge_${tsTag()}.json.gz`);
  const gz = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(outPath, gz);

  const shaPath = outPath + '.sha256';
  fs.writeFileSync(shaPath, `${sha}  ${path.basename(outPath)}\n`);

  console.log(`[backup] ✓ backup écrit : ${outPath}`);
  console.log(`         rows:   ${total} (${byTour.map(r => `${r.tour}=${r.n}`).join(', ')})`);
  console.log(`         sha256: ${sha}`);
  console.log(`         gzip:   ${gz.length} bytes (raw ${json.length})`);
  console.log(`         hash file: ${shaPath}`);
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error(`[backup] FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(2);
}
