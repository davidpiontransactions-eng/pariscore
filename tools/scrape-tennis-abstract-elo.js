#!/usr/bin/env node
/**
 * bd ParisScorebis-h6a — Tennis Abstract Elo scraper (SCAFFOLD, DISABLED legal)
 *
 * ============================================================================
 *  LEGAL STATUS : BLOCKED — CC BY-NC-SA 4.0 (NonCommercial)
 * ============================================================================
 *  Tennis Abstract / Jeff Sackmann data corpus (tennis_atp, tennis_wta,
 *  tennisabstract.com Elo reports) ships under Creative Commons
 *  Attribution-NonCommercial-ShareAlike 4.0. PariScore is a commercial SaaS
 *  (€19/mo Pro tier) → fundamentally incompatible with NonCommercial.
 *
 *  This file is a SCAFFOLD for a weekly drift check (compare Tennis Abstract
 *  Elo top-50 vs internal PariScore Elo in `tennis_elo` table). It is
 *  DISABLED by default and refuses to run unless the operator explicitly
 *  confirms a legal override via two independent flags:
 *
 *      env  TENNIS_ABSTRACT_ELO_SCRAPER=1
 *      env  LEGAL_OVERRIDE_CONFIRMED=1
 *      cli  --enable-legal-bypass-confirmed
 *
 *  Even with all three set, the tool only writes to a local SQLite table
 *  (`tennis_elo_drift_weekly`) for internal QA. Public surfacing of any
 *  scraped data (UI, API, exports) MUST remain gated until DG returns a
 *  written GO on bd ParisScorebis-8uoc (Q1).
 *
 *  Alternative path (RECOMMENDED): purge Sackmann tennis_matches and
 *  migrate to TML-Database (MIT licence). See .context/h6a-tennis-elo-spec.md
 *  section "Plan B - TML-Database substitution".
 *
 * ============================================================================
 *
 *  USAGE (research only, post-DG GO):
 *      TENNIS_ABSTRACT_ELO_SCRAPER=1 LEGAL_OVERRIDE_CONFIRMED=1 \
 *      node tools/scrape-tennis-abstract-elo.js \
 *           --enable-legal-bypass-confirmed [--tour=ATP|WTA|both] [--dry-run]
 *
 *  Defaults:
 *      tour    : both (ATP + WTA)
 *      dry-run : false (writes to tennis_elo_drift_weekly)
 *
 *  Endpoints (read-only HTML):
 *      https://www.tennisabstract.com/reports/atp_elo_ratings.html
 *      https://www.tennisabstract.com/reports/wta_elo_ratings.html
 *
 *  Output table : tennis_elo_drift_weekly (created on first run)
 *      player_id          TEXT  (Tennis Abstract player slug, e.g. "JannikSinner")
 *      player_name        TEXT
 *      tour               TEXT  ('ATP' | 'WTA')
 *      ta_elo             REAL  (Tennis Abstract Elo)
 *      ta_rank            INTEGER
 *      ps_elo             REAL  (PariScore internal Elo, surface='ALL')
 *      elo_drift          REAL  (ta_elo - ps_elo ; >0 → TA values higher)
 *      drift_abs          REAL
 *      captured_at        INTEGER  (unix seconds)
 *      source             TEXT  ('tennis_abstract')
 *      week_key           TEXT  (YYYY-Www, e.g. "2026-W21")
 *      PRIMARY KEY (player_id, tour, week_key)
 *
 *  Alarm threshold (per bd h6a acceptance criteria):
 *      |drift| > 100 Elo points on top-50 → log warning + flag row
 *
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');

// ---------------------------------------------------------------------------
// Legal gate — refuses to run unless all three confirmations present.
// ---------------------------------------------------------------------------
const FLAG_ENV = process.env.TENNIS_ABSTRACT_ELO_SCRAPER === '1';
const FLAG_LEGAL = process.env.LEGAL_OVERRIDE_CONFIRMED === '1';
const FLAG_CLI = process.argv.includes('--enable-legal-bypass-confirmed');
const DRY_RUN = process.argv.includes('--dry-run');
const TOUR_ARG = (process.argv.find(a => a.startsWith('--tour=')) || '--tour=both')
  .split('=')[1].toUpperCase();

function legalNotice() {
  console.log('');
  console.log('============================================================');
  console.log('  Tennis Abstract Elo scraper — bd ParisScorebis-h6a');
  console.log('============================================================');
  console.log('  LICENSE : CC BY-NC-SA 4.0 (NonCommercial ShareAlike)');
  console.log('  PariScore: commercial SaaS → INCOMPATIBLE.');
  console.log('  This tool is a SCAFFOLD; usage requires DG written GO.');
  console.log('  Reference tickets : h6a (this) + 8uoc (Q1 DG decision).');
  console.log('  Alternative path : TML-Database (MIT) — see h6a spec doc.');
  console.log('============================================================');
  console.log('');
}

function refuse(reason) {
  legalNotice();
  console.error(`[h6a] REFUSED — ${reason}`);
  console.error('[h6a] Required to proceed (research only, post-DG GO):');
  console.error('      env  TENNIS_ABSTRACT_ELO_SCRAPER=1');
  console.error('      env  LEGAL_OVERRIDE_CONFIRMED=1');
  console.error('      cli  --enable-legal-bypass-confirmed');
  process.exit(2);
}

if (!FLAG_ENV) refuse('TENNIS_ABSTRACT_ELO_SCRAPER env flag missing');
if (!FLAG_LEGAL) refuse('LEGAL_OVERRIDE_CONFIRMED env flag missing');
if (!FLAG_CLI) refuse('--enable-legal-bypass-confirmed CLI flag missing');

legalNotice();
console.warn('[h6a] ⚠ Proceeding with explicit legal override.');
console.warn('[h6a] ⚠ Output is internal QA only. DO NOT surface in UI/API.');

// ---------------------------------------------------------------------------
// Dependencies (lazy — only loaded post-gate to keep refuse path zero-dep).
// ---------------------------------------------------------------------------
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[h6a] better-sqlite3 not installed:', e.message);
  process.exit(3);
}

const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
if (!fs.existsSync(DB_PATH)) {
  console.error(`[h6a] DB not found at ${DB_PATH}`);
  process.exit(4);
}

// ---------------------------------------------------------------------------
// Schema — tennis_elo_drift_weekly
// ---------------------------------------------------------------------------
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tennis_elo_drift_weekly (
      player_id    TEXT NOT NULL,
      player_name  TEXT,
      tour         TEXT NOT NULL,
      ta_elo       REAL,
      ta_rank      INTEGER,
      ps_elo       REAL,
      elo_drift    REAL,
      drift_abs    REAL,
      captured_at  INTEGER NOT NULL,
      source       TEXT NOT NULL DEFAULT 'tennis_abstract',
      week_key     TEXT NOT NULL,
      PRIMARY KEY (player_id, tour, week_key)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_drift_week ON tennis_elo_drift_weekly(week_key, tour)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_drift_abs ON tennis_elo_drift_weekly(drift_abs DESC)`);
}

// ---------------------------------------------------------------------------
// HTTP — read-only fetch (no cookies, no auth, identifies as PariScore QA bot).
// ---------------------------------------------------------------------------
function fetchHtml(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'PariScore-QA-Bot/1.0 (+research drift check; bd-h6a)',
      'Accept': 'text/html,application/xhtml+xml',
    };
    const req = https.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Parser — Tennis Abstract Elo reports use <table id="reportable"> + <tr><td>.
// Columns vary by report; for atp/wta_elo_ratings.html the schema is approx :
//   Rank | Player | Age | Elo | hElo | cElo | gElo | Peak Elo | Peak Date
// We capture only rank, player, elo (overall, col index 3).
// ---------------------------------------------------------------------------
function parseEloReport(html, tour) {
  if (!html) return [];
  // Locate the reportable table; fall back to first <table>.
  const tableMatch = html.match(/<table[^>]*id=["']reportable["'][^>]*>([\s\S]*?)<\/table>/i)
                  || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const body = tableMatch[1];
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    const cells = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cm;
    while ((cm = cellRe.exec(m[1])) !== null) {
      // Strip tags + decode minimal entities + collapse whitespace
      const txt = cm[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(txt);
    }
    if (cells.length < 4) continue;
    const rank = parseInt(cells[0], 10);
    if (!Number.isFinite(rank)) continue;
    const name = cells[1];
    const elo = parseFloat(cells[3]);
    if (!name || !Number.isFinite(elo)) continue;
    rows.push({
      tour,
      ta_rank: rank,
      player_name: name,
      ta_elo: elo,
      player_id: slugify(name),
    });
  }
  return rows;
}

function slugify(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');
}

function normName(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ISO week key, e.g. "2026-W21"
function weekKey(ts) {
  const d = new Date(ts);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target - firstThu) / 86400000;
  const week = 1 + Math.round((diff - 3 + (firstThu.getUTCDay() + 6) % 7) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Compare TA Elo to PariScore tennis_elo (surface='ALL') by normalized name.
// ---------------------------------------------------------------------------
function loadPsEloMap(db, tour) {
  const out = new Map();
  try {
    const rows = db.prepare(
      `SELECT player_name, elo FROM tennis_elo WHERE tour = ? AND surface = 'ALL'`
    ).all(tour);
    for (const r of rows) {
      if (r.player_name && Number.isFinite(r.elo)) {
        out.set(normName(r.player_name), r.elo);
      }
    }
  } catch (e) {
    console.warn(`[h6a] tennis_elo lookup failed for ${tour}: ${e.message}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ENDPOINTS = {
  ATP: 'https://www.tennisabstract.com/reports/atp_elo_ratings.html',
  WTA: 'https://www.tennisabstract.com/reports/wta_elo_ratings.html',
};

async function runTour(db, tour) {
  console.log(`[h6a] Fetching ${tour} Elo report…`);
  const html = await fetchHtml(ENDPOINTS[tour]);
  const rows = parseEloReport(html, tour);
  console.log(`[h6a] ${tour}: parsed ${rows.length} rows`);
  if (!rows.length) return { tour, parsed: 0, written: 0, alarms: 0 };

  const psMap = loadPsEloMap(db, tour);
  const now = Math.floor(Date.now() / 1000);
  const wk = weekKey(Date.now());
  let written = 0;
  let alarms = 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tennis_elo_drift_weekly
      (player_id, player_name, tour, ta_elo, ta_rank, ps_elo,
       elo_drift, drift_abs, captured_at, source, week_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tennis_abstract', ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const it of items) {
      const ps = psMap.get(normName(it.player_name));
      const psElo = Number.isFinite(ps) ? ps : null;
      const drift = (psElo == null) ? null : (it.ta_elo - psElo);
      const driftAbs = (drift == null) ? null : Math.abs(drift);
      if (!DRY_RUN) {
        stmt.run(
          it.player_id, it.player_name, it.tour,
          it.ta_elo, it.ta_rank, psElo,
          drift, driftAbs, now, wk
        );
        written++;
      }
      if (it.ta_rank <= 50 && driftAbs != null && driftAbs > 100) {
        alarms++;
        console.warn(`[h6a][ALARM] ${tour} #${it.ta_rank} ${it.player_name}: TA=${it.ta_elo} PS=${psElo} drift=${drift.toFixed(0)}`);
      }
    }
  });

  insertMany(rows);
  console.log(`[h6a] ${tour}: ${DRY_RUN ? 'dry-run' : `wrote ${written}`} rows, ${alarms} alarms (week=${wk})`);
  return { tour, parsed: rows.length, written, alarms, week_key: wk };
}

(async () => {
  const db = new Database(DB_PATH);
  try {
    initSchema(db);
    const tours = TOUR_ARG === 'BOTH' ? ['ATP', 'WTA']
                : TOUR_ARG === 'ATP'  ? ['ATP']
                : TOUR_ARG === 'WTA'  ? ['WTA']
                : ['ATP', 'WTA'];
    const results = [];
    for (const t of tours) {
      try {
        results.push(await runTour(db, t));
      } catch (e) {
        console.error(`[h6a] ${t} run failed: ${e.message}`);
        results.push({ tour: t, error: e.message });
      }
    }
    console.log('[h6a] Done.', JSON.stringify(results));
  } finally {
    db.close();
  }
})().catch(e => {
  console.error('[h6a] Fatal:', e.message);
  process.exit(1);
});
