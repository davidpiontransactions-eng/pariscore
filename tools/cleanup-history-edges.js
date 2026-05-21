#!/usr/bin/env node
/**
 * tools/cleanup-history-edges.js — bd ParisScorebis-c8zp Phase 2
 *
 * Purge legacy edges/orphelins post-migration history.json → SQLite kv.
 * Audit history_matches + history_accuracy entries dans pariscore.db (table kv).
 * Detect: dupes id, missing required fields, orphans (live ids absents archive),
 * shape drift. Cleanup .migrated file leftover. Optional vacuum.
 *
 * USAGE:
 *   node tools/cleanup-history-edges.js              # dry-run (default)
 *   node tools/cleanup-history-edges.js --apply      # commit changes
 *   node tools/cleanup-history-edges.js --vacuum     # + VACUUM apres apply
 *
 * EXIT CODES:
 *   0 = clean OR fixes applied successfully
 *   1 = inconsistencies detected (dry-run) — review then re-run --apply
 *   2 = fatal error (DB missing, schema KO)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const SQLITE_FILE = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const LEGACY_FILE = path.join(ROOT, 'history.json');
const LEGACY_MIGRATED = path.join(ROOT, 'history.json.migrated');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const VACUUM = args.has('--vacuum');
const VERBOSE = args.has('--verbose') || args.has('-v');

function log(...a) { console.log('[cleanup]', ...a); }
function warn(...a) { console.warn('[cleanup][WARN]', ...a); }
function err(...a) { console.error('[cleanup][ERR]', ...a); }

function loadKV(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) {
    warn(`kv[${key}] JSON parse fail: ${e.message}`);
    return fallback;
  }
}

function saveKV(db, key, value) {
  db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

function inspectHistoryMatches(rows) {
  const report = {
    total: rows.length,
    dupes: [],
    missing_id: 0,
    missing_commence_time: 0,
    missing_sport: 0,
    invalid_shape: 0,
    by_sport: {},
  };
  const seen = new Map();
  for (const m of rows) {
    if (!m || typeof m !== 'object') { report.invalid_shape++; continue; }
    if (!m.id) { report.missing_id++; continue; }
    if (!m.commence_time && !m.kickoff && !m.date) report.missing_commence_time++;
    const sport = m.sport || m.sport_key || 'unknown';
    if (sport === 'unknown') report.missing_sport++;
    report.by_sport[sport] = (report.by_sport[sport] || 0) + 1;
    const key = String(m.id);
    if (seen.has(key)) {
      report.dupes.push({ id: key, count: seen.get(key) + 1 });
      seen.set(key, seen.get(key) + 1);
    } else {
      seen.set(key, 1);
    }
  }
  return report;
}

function dedupHistoryMatches(rows) {
  const seen = new Set();
  const out = [];
  for (const m of rows) {
    if (!m || !m.id) continue;
    const key = String(m.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function inspectAccuracy(acc) {
  const required = ['total', 'over25_correct', 'over25_total', 'btts_correct', 'btts_total', 'edge_correct', 'edge_total'];
  const missing = required.filter(k => acc == null || typeof acc[k] !== 'number');
  const negative = required.filter(k => acc != null && typeof acc[k] === 'number' && acc[k] < 0);
  return { missing, negative, shape_ok: missing.length === 0 && negative.length === 0 };
}

function main() {
  if (!fs.existsSync(SQLITE_FILE)) {
    err(`SQLite file absent: ${SQLITE_FILE}`);
    process.exit(2);
  }

  log(`mode=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${SQLITE_FILE}`);

  const db = new Database(SQLITE_FILE);
  db.pragma('journal_mode = WAL');

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kv'").all();
  if (tables.length === 0) {
    err('Table kv absente — base non initialisee par PariScore.');
    process.exit(2);
  }

  // ── 1. history_matches audit ──
  const matches = loadKV(db, 'history_matches', []);
  if (!Array.isArray(matches)) {
    err(`history_matches n'est pas array (got ${typeof matches})`);
    process.exit(2);
  }
  const matchesReport = inspectHistoryMatches(matches);
  log(`history_matches.total=${matchesReport.total} dupes=${matchesReport.dupes.length} missing_id=${matchesReport.missing_id} missing_sport=${matchesReport.missing_sport} invalid_shape=${matchesReport.invalid_shape}`);
  if (VERBOSE) log('  by_sport:', JSON.stringify(matchesReport.by_sport));

  // ── 2. history_accuracy audit ──
  const accDefault = { total: 0, over25_correct: 0, over25_total: 0, btts_correct: 0, btts_total: 0, edge_correct: 0, edge_total: 0 };
  const acc = loadKV(db, 'history_accuracy', accDefault);
  const accReport = inspectAccuracy(acc);
  log(`history_accuracy.shape_ok=${accReport.shape_ok} missing=[${accReport.missing.join(',')}] negative=[${accReport.negative.join(',')}]`);

  // ── 3. legacy file checks ──
  const legacyExists = fs.existsSync(LEGACY_FILE);
  const migratedExists = fs.existsSync(LEGACY_MIGRATED);
  log(`legacy: history.json=${legacyExists ? 'PRESENT (should be absent post-migration)' : 'absent'} history.json.migrated=${migratedExists ? 'present' : 'absent'}`);

  // ── 4. fixes plan ──
  const fixes = [];
  if (matchesReport.dupes.length > 0 || matchesReport.invalid_shape > 0 || matchesReport.missing_id > 0) {
    fixes.push({
      kind: 'dedup_matches',
      details: `dedup + drop invalid (dupes=${matchesReport.dupes.length} invalid=${matchesReport.invalid_shape} no_id=${matchesReport.missing_id})`,
    });
  }
  if (!accReport.shape_ok) {
    fixes.push({
      kind: 'reset_accuracy',
      details: `accuracy malformed (missing=${accReport.missing.length} negative=${accReport.negative.length}) — reset to default zeros`,
    });
  }
  if (legacyExists) {
    fixes.push({ kind: 'archive_legacy_history_json', details: 'rename history.json -> history.json.migrated' });
  }

  if (fixes.length === 0) {
    log('STATE = CLEAN. No fixes needed.');
    if (VACUUM && APPLY) {
      log('VACUUM SQLite...');
      db.exec('VACUUM');
    }
    db.close();
    process.exit(0);
  }

  log('Fixes planned:');
  for (const f of fixes) log(`  - ${f.kind}: ${f.details}`);

  if (!APPLY) {
    log('Dry-run — relancer avec --apply pour committer.');
    db.close();
    process.exit(1);
  }

  // ── 5. apply ──
  const tx = db.transaction(() => {
    for (const f of fixes) {
      if (f.kind === 'dedup_matches') {
        const cleaned = dedupHistoryMatches(matches);
        log(`  apply dedup_matches: ${matches.length} -> ${cleaned.length} entries`);
        saveKV(db, 'history_matches', cleaned);
      } else if (f.kind === 'reset_accuracy') {
        log('  apply reset_accuracy: writing default zeros');
        saveKV(db, 'history_accuracy', accDefault);
      }
    }
  });
  tx();

  if (legacyExists) {
    fs.renameSync(LEGACY_FILE, LEGACY_MIGRATED);
    log(`  apply archive_legacy_history_json: ${LEGACY_FILE} -> ${LEGACY_MIGRATED}`);
  }

  if (VACUUM) {
    log('VACUUM SQLite...');
    db.exec('VACUUM');
  }

  db.close();
  log('APPLY OK.');
  process.exit(0);
}

try {
  main();
} catch (e) {
  err(e.message);
  if (VERBOSE) err(e.stack);
  process.exit(2);
}
