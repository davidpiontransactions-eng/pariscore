#!/usr/bin/env node
/**
 * bd dl49 Phase 3 — ETL Tennis matches history INTERNAL (Sackmann replacement).
 *
 * Construit tennis_matches_internal depuis 3 sources propriétaires :
 *   1. api_cache rows where source='bsd_tennis' OR key LIKE 'bsd_tennis_matches_%'
 *   2. api_cache rows where source='espn_tennis' OR key LIKE 'espn_tennis_%'
 *   3. db.archive_tennis_matches array (database.json legacy)
 *
 * Schéma cible (subset Sackmann pour compat consumers) défini server.js
 * _initTennisInternalSchema. PRIMARY KEY (source, source_id) idempotency.
 *
 * USAGE:
 *   node tools/build-tennis-internal-history.js [--dry-run] [--force] [--source=bsd|espn|archive]
 *
 * EXIT CODES:
 *   0 OK    1 error    2 partial (au moins 1 source failed)
 *
 * NOTE: Phase 3 chunk initial — extracteurs simplifiés. Iterations futures
 * raffineront mapping fields selon variance schemas réels observés prod.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const DATABASE_JSON_PATH = path.join(ROOT, 'database.json');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE_FILTER = sourceArg ? sourceArg.split('=')[1] : null;

function normName(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function normSurface(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (/hard|dur/.test(s)) return 'Hard';
  if (/clay|terre|battue/.test(s)) return 'Clay';
  if (/grass|gazon/.test(s)) return 'Grass';
  if (/carpet|moquette/.test(s)) return 'Carpet';
  if (/indoor|salle/.test(s)) return 'Hard'; // indoor typiquement Hard
  return null;
}

function normTour(raw, gender) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('wta')) return 'WTA';
  if (s.includes('atp')) return 'ATP';
  if (gender === 'F' || gender === 'W' || /women|wta|fem/i.test(s)) return 'WTA';
  if (gender === 'M' || /men|atp|male/i.test(s)) return 'ATP';
  return null;
}

function parseSets(scoreStr) {
  // Format examples: "6-4 6-3", "7-6 4-6 6-2", null
  if (!scoreStr || typeof scoreStr !== 'string') return { sw: null, sl: null };
  let sw = 0, sl = 0;
  const sets = scoreStr.split(/\s+/).filter(Boolean);
  for (const set of sets) {
    const m = set.match(/^(\d+)-(\d+)(?:\(\d+\))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a > b) sw++; else if (b > a) sl++;
  }
  return { sw: sw || null, sl: sl || null };
}

function dateToYYYYMMDDInt(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`, 10);
}

// ── Extractor BSD ──────────────────────────────────────────────────────────
function extractFromBsdMatch(m) {
  if (!m || !m.id) return null;
  const status = String(m.status || '').toLowerCase();
  // Finished only — skip live/upcoming
  if (!/finished|complete|ended|fini|term/.test(status)) return null;

  const p1 = m.player1 || {};
  const p2 = m.player2 || {};
  const p1Name = p1.name || p1.short_name || null;
  const p2Name = p2.name || p2.short_name || null;
  if (!p1Name || !p2Name) return null;

  // Determine winner from m.winner OR sets count OR score
  let winnerIsP1 = null;
  if (m.winner != null) {
    winnerIsP1 = (m.winner === 1 || m.winner === '1' || m.winner === 'p1');
  } else if (m.sets_won_p1 != null && m.sets_won_p2 != null) {
    if (m.sets_won_p1 > m.sets_won_p2) winnerIsP1 = true;
    else if (m.sets_won_p2 > m.sets_won_p1) winnerIsP1 = false;
  }
  if (winnerIsP1 == null) return null;  // ambiguity skip

  const score = m.score || (Array.isArray(m.sets) ? m.sets.map(s => `${s.p1 || 0}-${s.p2 || 0}`).join(' ') : null);
  const setsCount = parseSets(score);
  const tournament = m.tournament || {};
  const tour = normTour(tournament.circuit || tournament.tour, m.gender || tournament.gender);
  const surface = normSurface(tournament.surface || m.surface);

  // bd dl49 Phase 4.1 — Serve stats inline BSD per match data.
  // BSD expose p1_aces, p2_aces, p1_double_faults, p2_double_faults,
  // p1_first_serve_pct, p2_first_serve_pct directement dans match payload.
  // Map vers winner/loser perspective Sackmann-compat.
  // BSD n'expose PAS svpt/1stIn/1stWon/2ndWon/SvGms/bpSaved/bpFaced separately
  // → NULL pour ces cols (consumers ignorent via WHERE IS NOT NULL).
  const w_ace = winnerIsP1 ? toIntOrNull(m.p1_aces) : toIntOrNull(m.p2_aces);
  const l_ace = winnerIsP1 ? toIntOrNull(m.p2_aces) : toIntOrNull(m.p1_aces);
  const w_df = winnerIsP1 ? toIntOrNull(m.p1_double_faults) : toIntOrNull(m.p2_double_faults);
  const l_df = winnerIsP1 ? toIntOrNull(m.p2_double_faults) : toIntOrNull(m.p1_double_faults);
  // Player metadata Sackmann compat — BSD nationality si dispo
  const w_ioc = winnerIsP1 ? (p1.country || p1.nationality || null) : (p2.country || p2.nationality || null);
  const l_ioc = winnerIsP1 ? (p2.country || p2.nationality || null) : (p1.country || p1.nationality || null);
  const w_hand = winnerIsP1 ? (p1.hand || p1.playing_hand || null) : (p2.hand || p2.playing_hand || null);
  const l_hand = winnerIsP1 ? (p2.hand || p2.playing_hand || null) : (p1.hand || p1.playing_hand || null);

  return {
    source: 'bsd',
    source_id: String(m.id),
    tour,
    tourney_name: tournament.name || null,
    tourney_id: Number.isFinite(Number(tournament.id)) ? Number(tournament.id) : null,
    surface,
    tourney_date: dateToYYYYMMDDInt(tournament.start_date || m.match_date),
    match_date: m.match_date ? Date.parse(m.match_date) || null : null,
    winner_name: winnerIsP1 ? p1Name : p2Name,
    loser_name: winnerIsP1 ? p2Name : p1Name,
    winner_player_id: Number.isFinite(Number(winnerIsP1 ? p1.id : p2.id)) ? Number(winnerIsP1 ? p1.id : p2.id) : null,
    loser_player_id: Number.isFinite(Number(winnerIsP1 ? p2.id : p1.id)) ? Number(winnerIsP1 ? p2.id : p1.id) : null,
    score,
    sets_winner: setsCount.sw,
    sets_loser: setsCount.sl,
    best_of: m.best_of || (tournament.best_of) || null,
    round: m.round || m.round_name || null,
    status: 'finished',
    minutes: Number.isFinite(Number(m.duration_minutes || m.minutes)) ? Number(m.duration_minutes || m.minutes) : null,
    // Phase 4.1 serve stats (BSD inline)
    w_ace, l_ace, w_df, l_df,
    w_ioc, l_ioc, w_hand, l_hand,
    // Cols Sackmann-only (svpt/1stIn/etc) restent absentes → null SQL upsert
  };
}

function toIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ─── Extractor BSD CALIB_RAW (gold mine — match nested + actual_winner) ────
// Source : api_cache key='bsd_tennis_calib_raw' (1600+ items per snapshot).
// Schema item : {id, match:{id, api_id, tournament:{...}, player1:{...}, player2:{...},
//                match_date, status, round_name, player1_sets, player2_sets, sets_detail},
//                prob_*, predicted_winner, actual_winner, was_winner_correct}
// status='finished' garanti par calibration scope. actual_winner=1|2.
function extractFromBsdCalibItem(item) {
  if (!item || !item.match) return null;
  const mch = item.match;
  if (!mch.id) return null;
  if (String(mch.status || '').toLowerCase() !== 'finished') return null;

  const aw = item.actual_winner;
  if (aw !== 1 && aw !== 2) return null;
  const winnerIsP1 = aw === 1;

  const p1 = mch.player1 || {};
  const p2 = mch.player2 || {};
  const p1Name = p1.name || p1.short_name || null;
  const p2Name = p2.name || p2.short_name || null;
  if (!p1Name || !p2Name) return null;

  const t = mch.tournament || {};
  const tour = normTour(t.circuit, p1.gender || p2.gender || t.gender);
  const surface = normSurface(t.surface);

  // Parse sets_detail array → score string "6-4 7-6" winner-perspective
  let score = null;
  if (Array.isArray(mch.sets_detail) && mch.sets_detail.length > 0) {
    score = mch.sets_detail.map(s => {
      const wp = winnerIsP1 ? (s.p1 || 0) : (s.p2 || 0);
      const lp = winnerIsP1 ? (s.p2 || 0) : (s.p1 || 0);
      return `${wp}-${lp}`;
    }).join(' ');
  }

  // sets count from outer match (already determined winner perspective via winnerIsP1)
  const setsW = winnerIsP1 ? (mch.player1_sets || 0) : (mch.player2_sets || 0);
  const setsL = winnerIsP1 ? (mch.player2_sets || 0) : (mch.player1_sets || 0);

  // Player metadata + rank seed
  const wRanking = winnerIsP1 ? (p1.current_ranking || {}) : (p2.current_ranking || {});
  const lRanking = winnerIsP1 ? (p2.current_ranking || {}) : (p1.current_ranking || {});

  return {
    source: 'bsd_calib',
    source_id: String(mch.id),
    tour,
    tourney_name: t.name || null,
    tourney_id: Number.isFinite(Number(t.id)) ? Number(t.id) : null,
    surface,
    tourney_date: dateToYYYYMMDDInt(mch.match_date),
    match_date: mch.match_date ? Date.parse(mch.match_date) || null : null,
    winner_name: winnerIsP1 ? p1Name : p2Name,
    loser_name: winnerIsP1 ? p2Name : p1Name,
    winner_player_id: Number.isFinite(Number(winnerIsP1 ? p1.id : p2.id)) ? Number(winnerIsP1 ? p1.id : p2.id) : null,
    loser_player_id: Number.isFinite(Number(winnerIsP1 ? p2.id : p1.id)) ? Number(winnerIsP1 ? p2.id : p1.id) : null,
    score,
    sets_winner: setsW || null,
    sets_loser: setsL || null,
    best_of: null,  // calib_raw n'expose pas
    round: mch.round_name || null,
    status: 'finished',
    minutes: null,
    // Serve stats inline calib_raw : pas exposé directement (predictions seulement)
    w_ace: null, l_ace: null, w_df: null, l_df: null,
    // Player metadata Sackmann compat
    w_ioc: winnerIsP1 ? (p1.country_code || null) : (p2.country_code || null),
    l_ioc: winnerIsP1 ? (p2.country_code || null) : (p1.country_code || null),
    w_hand: null, l_hand: null,
    // Rank seed Bayésien (cold-start Elo)
    winner_rank: Number.isFinite(Number(wRanking.position)) ? Number(wRanking.position) : null,
    winner_rank_points: Number.isFinite(Number(wRanking.points)) ? Number(wRanking.points) : null,
    loser_rank: Number.isFinite(Number(lRanking.position)) ? Number(lRanking.position) : null,
    loser_rank_points: Number.isFinite(Number(lRanking.points)) ? Number(lRanking.points) : null,
  };
}

// ── Extractor ESPN ─────────────────────────────────────────────────────────
function extractFromEspnEvent(e) {
  if (!e || !e.id) return null;
  const status = String((e.status && e.status.type && e.status.type.name) || e.status || '').toLowerCase();
  if (!/final|completed|ended/.test(status)) return null;
  const comps = (e.competitions && e.competitions[0]) || {};
  const competitors = comps.competitors || [];
  if (competitors.length !== 2) return null;
  const c1 = competitors[0], c2 = competitors[1];
  const winnerC = c1.winner ? c1 : (c2.winner ? c2 : null);
  if (!winnerC) return null;
  const loserC = winnerC === c1 ? c2 : c1;
  const wAthlete = (winnerC.athlete || winnerC.team) || {};
  const lAthlete = (loserC.athlete || loserC.team) || {};
  const wName = wAthlete.displayName || wAthlete.shortName || null;
  const lName = lAthlete.displayName || lAthlete.shortName || null;
  if (!wName || !lName) return null;
  const score = (comps.linescores || [])
    .map(ls => `${ls.value || ''}-${ls.value2 || ''}`)
    .join(' ').trim() || (winnerC.score && loserC.score ? `${winnerC.score}-${loserC.score}` : null);
  const setsCount = parseSets(score);
  const tournament = (e.season && e.season.name) || (e.league && e.league.name) || null;
  return {
    source: 'espn',
    source_id: String(e.id),
    tour: null,  // ESPN ne distingue pas ATP/WTA dans tous endpoints
    tourney_name: tournament,
    tourney_id: null,
    surface: normSurface(comps.venue && comps.venue.surface),
    tourney_date: dateToYYYYMMDDInt(e.date),
    match_date: e.date ? Date.parse(e.date) || null : null,
    winner_name: wName,
    loser_name: lName,
    winner_player_id: Number.isFinite(Number(wAthlete.id)) ? Number(wAthlete.id) : null,
    loser_player_id: Number.isFinite(Number(lAthlete.id)) ? Number(lAthlete.id) : null,
    score,
    sets_winner: setsCount.sw,
    sets_loser: setsCount.sl,
    best_of: null,
    round: (e.notes && e.notes[0] && e.notes[0].headline) || null,
    status: 'finished',
    minutes: null,
  };
}

// ── Extractor archive_tennis_matches (legacy) ──────────────────────────────
function extractFromArchive(m) {
  if (!m || (!m.id && !m._archiveId)) return null;
  const id = m.id || m._archiveId;
  // archive may have varying fields — best-effort
  const winner = m.winner || m.winner_name || null;
  const loser = m.loser || m.loser_name || null;
  if (!winner || !loser) return null;
  return {
    source: 'archive',
    source_id: String(id),
    tour: normTour(m.tour || m.circuit, m.gender),
    tourney_name: m.tournament || m.tourney_name || null,
    tourney_id: null,
    surface: normSurface(m.surface),
    tourney_date: dateToYYYYMMDDInt(m.tourney_date || m.match_date),
    match_date: m.match_date ? (Date.parse(m.match_date) || null) : null,
    winner_name: winner,
    loser_name: loser,
    winner_player_id: null,
    loser_player_id: null,
    score: m.score || null,
    sets_winner: null,
    sets_loser: null,
    best_of: m.best_of || null,
    round: m.round || null,
    status: 'finished',
    minutes: null,
  };
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[etl] DB introuvable: ${DB_PATH}`);
    process.exit(1);
  }
  const db = new Database(DB_PATH);

  // Schema init (idempotent — mirror server.js function)
  db.exec(`CREATE TABLE IF NOT EXISTS tennis_matches_internal (
    source TEXT NOT NULL, source_id TEXT NOT NULL,
    tour TEXT, tourney_name TEXT, tourney_id INTEGER, surface TEXT,
    tourney_date INTEGER, match_date INTEGER,
    winner_name TEXT, loser_name TEXT, winner_player_id INTEGER, loser_player_id INTEGER,
    score TEXT, sets_winner INTEGER, sets_loser INTEGER, best_of INTEGER, round TEXT,
    status TEXT, minutes INTEGER,
    imported_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (source, source_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tmi_date ON tennis_matches_internal(tourney_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tmi_winner_name ON tennis_matches_internal(winner_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tmi_loser_name ON tennis_matches_internal(loser_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tmi_surface ON tennis_matches_internal(surface, tour)`);

  // bd dl49 Phase 4.1 — ALTER serve+rank+metadata cols idempotent (mirror server.js)
  const altCols = [
    ['w_ace', 'INTEGER'], ['w_df', 'INTEGER'], ['w_svpt', 'INTEGER'],
    ['w_1stIn', 'INTEGER'], ['w_1stWon', 'INTEGER'], ['w_2ndWon', 'INTEGER'],
    ['w_SvGms', 'INTEGER'], ['w_bpSaved', 'INTEGER'], ['w_bpFaced', 'INTEGER'],
    ['l_ace', 'INTEGER'], ['l_df', 'INTEGER'], ['l_svpt', 'INTEGER'],
    ['l_1stIn', 'INTEGER'], ['l_1stWon', 'INTEGER'], ['l_2ndWon', 'INTEGER'],
    ['l_SvGms', 'INTEGER'], ['l_bpSaved', 'INTEGER'], ['l_bpFaced', 'INTEGER'],
    ['winner_rank', 'INTEGER'], ['winner_rank_points', 'INTEGER'],
    ['loser_rank', 'INTEGER'], ['loser_rank_points', 'INTEGER'],
    ['winner_hand', 'TEXT'], ['loser_hand', 'TEXT'],
    ['winner_ioc', 'TEXT'], ['loser_ioc', 'TEXT'],
    ['winner_age', 'REAL'], ['loser_age', 'REAL'],
  ];
  try {
    const existingCols = new Set(db.prepare(`PRAGMA table_info(tennis_matches_internal)`).all().map(c => c.name));
    const SAFE_COL = /^[a-z_][a-z0-9_]*$/i;
    const SAFE_TYPES = new Set(['INTEGER', 'TEXT', 'REAL', 'NUMERIC', 'BLOB']);
    for (const [name, type] of altCols) {
      if (!SAFE_COL.test(name) || !SAFE_TYPES.has(type)) continue; // guard against injection
      if (!existingCols.has(name)) db.exec(`ALTER TABLE tennis_matches_internal ADD COLUMN ${name} ${type}`);
    }
  } catch (e) { console.warn('[etl] ALTER serve cols failed:', e.message); }

  const summary = { bsd: 0, bsd_calib: 0, espn: 0, archive: 0, skipped: 0, errors: [], serveCovered: 0, rankCovered: 0 };
  const upsertStmt = db.prepare(`INSERT OR REPLACE INTO tennis_matches_internal (
    source, source_id, tour, tourney_name, tourney_id, surface,
    tourney_date, match_date, winner_name, loser_name, winner_player_id, loser_player_id,
    score, sets_winner, sets_loser, best_of, round, status, minutes,
    w_ace, l_ace, w_df, l_df,
    winner_ioc, loser_ioc, winner_hand, loser_hand,
    winner_rank, winner_rank_points, loser_rank, loser_rank_points
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const upsertOne = (row) => {
    if (!row) { summary.skipped++; return; }
    const srcKey = summary[row.source] != null ? row.source : 'errors';
    if (DRY_RUN) {
      if (summary[row.source] != null) summary[row.source]++;
      if (row.w_ace != null || row.l_ace != null) summary.serveCovered++;
      if (row.winner_rank != null || row.loser_rank != null) summary.rankCovered++;
      return;
    }
    try {
      upsertStmt.run(
        row.source, row.source_id, row.tour, row.tourney_name, row.tourney_id, row.surface,
        row.tourney_date, row.match_date, row.winner_name, row.loser_name,
        row.winner_player_id, row.loser_player_id, row.score, row.sets_winner, row.sets_loser,
        row.best_of, row.round, row.status, row.minutes,
        row.w_ace || null, row.l_ace || null, row.w_df || null, row.l_df || null,
        row.w_ioc || null, row.l_ioc || null, row.w_hand || null, row.l_hand || null,
        row.winner_rank || null, row.winner_rank_points || null,
        row.loser_rank || null, row.loser_rank_points || null
      );
      if (summary[row.source] != null) summary[row.source]++;
      if (row.w_ace != null || row.l_ace != null) summary.serveCovered++;
      if (row.winner_rank != null || row.loser_rank != null) summary.rankCovered++;
    } catch (e) {
      summary.errors.push({ source: row.source, source_id: row.source_id, err: e.message });
    }
  };

  // ── Source BSD : api_cache rows (raw matches endpoints — generic) ────────
  if (!SOURCE_FILTER || SOURCE_FILTER === 'bsd') {
    try {
      // Generic BSD tennis matches cached (RG/tournament matches : bsd_rg_m_*)
      const rows = db.prepare(`SELECT key, data FROM api_cache WHERE key LIKE 'bsd_rg_m_%' OR key LIKE 'bsd_tennis_matches_%'`).all();
      console.log(`[etl] BSD raw matches: ${rows.length} cache entries trouvées`);
      const tx = db.transaction(() => {
        for (const r of rows) {
          let data;
          try { data = JSON.parse(r.data); } catch { continue; }
          const matches = Array.isArray(data) ? data : (data && data.results) || [];
          for (const m of matches) upsertOne(extractFromBsdMatch(m));
        }
      });
      tx();
    } catch (e) {
      console.warn(`[etl] BSD error: ${e.message}`);
      summary.errors.push({ source: 'bsd', err: e.message });
    }
  }

  // ── Source BSD CALIB_RAW : 1600+ finished items avec actual_winner ───────
  // Source primaire dl49 — couvre matchs settled via calibration scope BSD.
  if (!SOURCE_FILTER || SOURCE_FILTER === 'bsd_calib') {
    try {
      const rows = db.prepare(`SELECT key, data FROM api_cache WHERE key='bsd_tennis_calib_raw'`).all();
      console.log(`[etl] BSD calib_raw: ${rows.length} cache entries trouvées`);
      const tx = db.transaction(() => {
        for (const r of rows) {
          let data;
          try { data = JSON.parse(r.data); } catch { continue; }
          const items = Array.isArray(data) ? data : (data && data.results) || [];
          for (const item of items) upsertOne(extractFromBsdCalibItem(item));
        }
      });
      tx();
    } catch (e) {
      console.warn(`[etl] BSD calib error: ${e.message}`);
      summary.errors.push({ source: 'bsd_calib', err: e.message });
    }
  }

  // ── Source ESPN : api_cache rows ─────────────────────────────────────────
  if (!SOURCE_FILTER || SOURCE_FILTER === 'espn') {
    try {
      const rows = db.prepare(`SELECT key, data FROM api_cache WHERE source LIKE 'espn_tennis%' OR key LIKE 'espn_tennis_%'`).all();
      console.log(`[etl] ESPN: ${rows.length} cache entries trouvées`);
      const tx = db.transaction(() => {
        for (const r of rows) {
          let data;
          try { data = JSON.parse(r.data); } catch { continue; }
          const events = Array.isArray(data) ? data : (data && data.events) || [];
          for (const e of events) upsertOne(extractFromEspnEvent(e));
        }
      });
      tx();
    } catch (e) {
      console.warn(`[etl] ESPN error: ${e.message}`);
      summary.errors.push({ source: 'espn', err: e.message });
    }
  }

  // ── Source archive (database.json) ───────────────────────────────────────
  if (!SOURCE_FILTER || SOURCE_FILTER === 'archive') {
    try {
      if (fs.existsSync(DATABASE_JSON_PATH)) {
        const dbJson = JSON.parse(fs.readFileSync(DATABASE_JSON_PATH, 'utf8'));
        const arr = Array.isArray(dbJson.archive_tennis_matches) ? dbJson.archive_tennis_matches : [];
        console.log(`[etl] archive: ${arr.length} entries trouvées`);
        const tx = db.transaction(() => {
          for (const m of arr) upsertOne(extractFromArchive(m));
        });
        tx();
      } else {
        console.log(`[etl] archive: database.json absent — skip`);
      }
    } catch (e) {
      console.warn(`[etl] archive error: ${e.message}`);
      summary.errors.push({ source: 'archive', err: e.message });
    }
  }

  const total = summary.bsd + summary.bsd_calib + summary.espn + summary.archive;
  console.log(`\n[etl] ✓ TERMINÉ${DRY_RUN ? ' (DRY-RUN — aucune écriture)' : ''}`);
  console.log(`  bsd (raw)      : ${summary.bsd}`);
  console.log(`  bsd_calib      : ${summary.bsd_calib}`);
  console.log(`  espn           : ${summary.espn}`);
  console.log(`  archive        : ${summary.archive}`);
  console.log(`  skipped        : ${summary.skipped}`);
  console.log(`  total          : ${total}`);
  console.log(`  serve_covered  : ${summary.serveCovered}${total > 0 ? ` (${Math.round(summary.serveCovered / total * 100)}%)` : ''}`);
  console.log(`  rank_covered   : ${summary.rankCovered}${total > 0 ? ` (${Math.round(summary.rankCovered / total * 100)}%)` : ''}`);
  if (summary.errors.length) {
    console.log(`  errors  : ${summary.errors.length}`);
    summary.errors.slice(0, 5).forEach(e => console.log(`    • ${e.source}: ${e.err}`));
  }

  if (!DRY_RUN) {
    const finalCount = db.prepare(`SELECT COUNT(*) AS n FROM tennis_matches_internal`).get().n;
    console.log(`\n  Table tennis_matches_internal : ${finalCount} rows total après ETL`);
  }

  db.close();
  process.exit(summary.errors.length > 0 ? 2 : 0);
}

try {
  main();
} catch (e) {
  console.error(`[etl] FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
}
