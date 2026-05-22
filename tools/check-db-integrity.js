#!/usr/bin/env node
/**
 * bd b50 — Vérification intégrité SQLite pariscore.db
 *
 * Diagnose un fichier pariscore.db (par défaut racine projet, override via
 * --db=path). Lance PRAGMA integrity_check + PRAGMA quick_check + métriques
 * tailles WAL/SHM + counts par table. Exit code 0 si OK, 1 si KO.
 *
 * USAGE:
 *   node tools/check-db-integrity.js [--db=pariscore.db] [--verbose]
 *
 * Ops VPS (post-incident SQLITE_NOTADB) :
 *   cp pariscore.db pariscore.db.bak.$(date +%s)
 *   node tools/check-db-integrity.js
 *   # Si KO :
 *   sqlite3 pariscore.db ".recover" | sqlite3 pariscore.recovered.db
 *   mv pariscore.db pariscore.db.corrupt-$(date +%s)
 *   mv pariscore.recovered.db pariscore.db
 *   pm2 restart pariscore
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, v = true] = a.slice(2).split('='); return [k, v]; }));

const DB_PATH = args.db ? path.resolve(ROOT, args.db) : path.join(ROOT, 'pariscore.db');
const VERBOSE = !!args.verbose;

function fmtSize(b) {
  if (b == null) return 'n/a';
  if (b < 1024) return b + 'B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + 'KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + 'MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}

function fmtTs(ts) {
  if (!ts) return 'n/a';
  return new Date(ts).toISOString();
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  PariScore SQLite Integrity Check (bd b50)`);
console.log(`══════════════════════════════════════════════════════════════\n`);
console.log(`  DB path  : ${DB_PATH}`);

if (!fs.existsSync(DB_PATH)) {
  console.error(`\n  ✗ DB introuvable : ${DB_PATH}\n`);
  process.exit(1);
}

const stat = fs.statSync(DB_PATH);
console.log(`  Size     : ${fmtSize(stat.size)} (${stat.size} bytes)`);
console.log(`  mtime    : ${fmtTs(stat.mtimeMs)}`);
console.log(`  ctime    : ${fmtTs(stat.ctimeMs)}`);

for (const suf of ['-wal', '-shm']) {
  const p = DB_PATH + suf;
  if (fs.existsSync(p)) {
    const s = fs.statSync(p);
    console.log(`  ${suf.padEnd(8)} : ${fmtSize(s.size)} mtime=${fmtTs(s.mtimeMs)}`);
  } else {
    console.log(`  ${suf.padEnd(8)} : absent (normal si checkpoint récent)`);
  }
}

// Free disk (best-effort, POSIX-only via fs.statfs Node 18.15+)
try {
  if (typeof fs.statfsSync === 'function') {
    const fsStat = fs.statfsSync(path.dirname(DB_PATH));
    const freeBytes = fsStat.bfree * fsStat.bsize;
    const totalBytes = fsStat.blocks * fsStat.bsize;
    const usedPct = ((1 - fsStat.bfree / fsStat.blocks) * 100).toFixed(1);
    console.log(`  Disk     : free ${fmtSize(freeBytes)} / ${fmtSize(totalBytes)} (used ${usedPct}%)`);
    if (freeBytes < 100 * 1024 * 1024) {
      console.error(`  ⚠  DISQUE PRESQUE PLEIN — cause probable SQLITE_NOTADB (write tronqué)`);
    }
  }
} catch (_) { /* non-bloquant */ }

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error(`\n  ✗ better-sqlite3 introuvable. Lancez : npm install\n`);
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (e) {
  console.error(`\n  ✗ Ouverture échouée : ${e.code || ''} ${e.message}`);
  if (e.code === 'SQLITE_NOTADB' || e.code === 'SQLITE_CORRUPT') {
    console.error(`\n  → Fichier corrompu. Récupération :`);
    console.error(`    sqlite3 ${DB_PATH} ".recover" | sqlite3 ${DB_PATH}.recovered`);
    console.error(`    mv ${DB_PATH} ${DB_PATH}.corrupt-$(date +%s)`);
    console.error(`    mv ${DB_PATH}.recovered ${DB_PATH}\n`);
  }
  process.exit(1);
}

let exitCode = 0;

try {
  console.log(`\n  ── PRAGMA quick_check ────────────────────────────────────`);
  const qc = db.pragma('quick_check');
  const qcVal = Array.isArray(qc) && qc[0] ? String(qc[0].quick_check) : 'n/a';
  console.log(`  quick_check : ${qcVal}`);
  if (qcVal.toLowerCase() !== 'ok') exitCode = 1;

  console.log(`\n  ── PRAGMA integrity_check ────────────────────────────────`);
  const ic = db.pragma('integrity_check');
  const icRows = Array.isArray(ic) ? ic : [];
  if (icRows.length === 1 && String(icRows[0].integrity_check).toLowerCase() === 'ok') {
    console.log(`  integrity_check : ok`);
  } else {
    console.error(`  integrity_check : ${icRows.length} problème(s)`);
    icRows.slice(0, 20).forEach(r => console.error(`    • ${r.integrity_check}`));
    exitCode = 1;
  }

  console.log(`\n  ── Pragmas runtime ───────────────────────────────────────`);
  const jm = db.pragma('journal_mode', { simple: true });
  const sync = db.pragma('synchronous', { simple: true });
  const bt = db.pragma('busy_timeout', { simple: true });
  const fk = db.pragma('foreign_keys', { simple: true });
  const pc = db.pragma('page_count', { simple: true });
  const ps = db.pragma('page_size', { simple: true });
  console.log(`  journal_mode  : ${jm}  ${jm === 'wal' ? '✓' : '(attendu wal)'}`);
  console.log(`  synchronous   : ${sync}`);
  console.log(`  busy_timeout  : ${bt}ms`);
  console.log(`  foreign_keys  : ${fk}`);
  console.log(`  page_count    : ${pc}  × page_size ${ps} = ${fmtSize(pc * ps)}`);

  console.log(`\n  ── Tables ────────────────────────────────────────────────`);
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  for (const t of tables) {
    try {
      const c = db.prepare(`SELECT COUNT(*) as n FROM ${t.name}`).get();
      console.log(`  ${t.name.padEnd(30)} ${String(c.n).padStart(10)} rows`);
    } catch (e) {
      console.error(`  ${t.name.padEnd(30)} ✗ ${e.code || ''} ${e.message}`);
      exitCode = 1;
    }
  }

  if (VERBOSE) {
    console.log(`\n  ── api_cache stats par source ────────────────────────────`);
    try {
      const stats = db.prepare(`SELECT source, COUNT(*) as n, MIN(created_at) as min_ts, MAX(expires_at) as max_exp FROM api_cache GROUP BY source ORDER BY n DESC`).all();
      for (const s of stats) {
        console.log(`  ${String(s.source).padEnd(30)} ${String(s.n).padStart(8)}  oldest=${fmtTs(s.min_ts)}`);
      }
    } catch (e) {
      console.error(`  api_cache stats : ${e.message}`);
    }
  }
} catch (e) {
  console.error(`\n  ✗ Erreur diagnostic : ${e.code || ''} ${e.message}`);
  exitCode = 1;
} finally {
  try { db.close(); } catch (_) {}
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  Résultat : ${exitCode === 0 ? '\x1b[32m✓ DB SAINE\x1b[0m' : '\x1b[31m✗ DB CORROMPUE — voir runbook .context/ops/db-recovery-runbook.md\x1b[0m'}`);
console.log(`══════════════════════════════════════════════════════════════\n`);

process.exit(exitCode);
