#!/usr/bin/env node
/**
 * PariScore — Cron incremental match_stats_history refresh
 *
 * Rattrape quotidiennement les matchs BSD "finished" depuis la dernière run
 * et upsert dans match_stats_history. Resume-safe par timestamp last_run.
 *
 * SCHEDULING (PM2) — ajouter dans ecosystem.config.js :
 *   {
 *     name: 'pariscore-cron-match-stats',
 *     script: 'scripts/cron_refresh_match_stats.js',
 *     cwd: '/home/ubuntu/pariscore',
 *     cron_restart: '0 3 * * *',   // chaque nuit à 03:00 UTC
 *     autorestart: false,
 *     instances: 1,
 *     exec_mode: 'fork',
 *     max_memory_restart: '512M',
 *     env: { NODE_ENV: 'production' },
 *     error_file: 'logs/cron-match-stats.err.log',
 *     out_file: 'logs/cron-match-stats.out.log',
 *     log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
 *     time: true,
 *   }
 *
 * USAGE:
 *   node scripts/cron_refresh_match_stats.js
 *   node scripts/cron_refresh_match_stats.js --days=7    # force fenêtre 7j
 *   node scripts/cron_refresh_match_stats.js --dry        # dry run
 *
 * EXIT CODES:
 *   0 = OK (≥0 matchs traités)
 *   1 = erreur fatale
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[cron-match-stats] .env introuvable — abandon');
  process.exit(1);
}

const BSD_API_KEY = ENV.BSD_API_KEY;
if (!BSD_API_KEY) {
  console.error('[cron-match-stats] BSD_API_KEY absent du .env — abandon');
  process.exit(1);
}

const BSD_BASE_URL = ENV.BSD_BASE_URL || 'https://sports.bzzoiro.com/api';
const DB_PATH = ENV.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const STATE_FILE = path.join(ROOT, '.cron_match_stats_state.json');

const THROTTLE_MS = 300;
const PAGE_LIMIT = 100;

// Ligues BSD depuis seed_historique_bsd_stats.js
const BSD_LEAGUE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 17, 18, 19, 20,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 38, 39, 40, 41, 42,
  43, 44, 46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69
];

// ── CLI args ──────────────────────────────────────────────────────────────────
const isDry = process.argv.includes('--dry');
const daysArg = process.argv.find(a => a.startsWith('--days='));
const FORCE_DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : null;

// ── State management (resume-safe) ────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[cron-match-stats] state file corrompu, reprise à zéro:', e.message);
  }
  return { last_run: null };
}

function saveState(state) {
  state.last_run = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pause = ms => new Promise(r => setTimeout(r, ms));
const num = v => (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);

function bsdFetch(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${BSD_BASE_URL}${endpoint}`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Token ${BSD_API_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode >= 500) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function bsdFetchRetry(endpoint, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await bsdFetch(endpoint); }
    catch (e) {
      if (i === retries) throw e;
      await pause(1500 * (i + 1));
    }
  }
}

// ── Extracteurs (identiques à seed_historique_bsd_stats.js) ──────────────────
function extractSide(s) {
  if (!s) return {};
  const passes = num(s.passes);
  const accuratePasses = num(s.accurate_passes);
  return {
    shots: num(s.total_shots),
    sot: num(s.shots_on_target),
    shotsInside: num(s.shots_inside_box),
    blocked: num(s.blocked_shots),
    corners: num(s.corner_kicks),
    possession: num(s.ball_possession),
    bigChances: num(s.big_chances),
    bigChancesMissed: num(s.big_chances_missed),
    passes,
    passAcc: (passes && accuratePasses != null) ? Math.round(accuratePasses / passes * 1000) / 10 : null,
    yellow: num(s.yellow_cards),
    fouls: num(s.fouls),
    offsides: num(s.offsides),
    touchesBox: num(s.touches_in_penalty_area),
    finalThird: num(s.final_third_entries),
    woodwork: num(s.hit_woodwork),
    goalsPrevented: num(s.goals_prevented),
    xg: num(s.expected_goals),
  };
}

function extractHalfSide(s) {
  if (!s) return {};
  return {
    xg: num(s.expected_goals),
    corners: num(s.corner_kicks),
    shots: num(s.total_shots),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  console.log(`[cron-match-stats] start at ${new Date().toISOString()}`);

  // Determine date window
  const state = loadState();
  let dateFrom;
  if (FORCE_DAYS !== null) {
    const d = new Date();
    d.setDate(d.getDate() - FORCE_DAYS);
    dateFrom = d.toISOString().split('T')[0];
    console.log(`[cron-match-stats] forced window: --days=${FORCE_DAYS} → from ${dateFrom}`);
  } else if (state.last_run) {
    const d = new Date(state.last_run);
    d.setDate(d.getDate() - 1); // 1j de chevauchement pour couvrir les matchs qui terminent pile à minuit
    dateFrom = d.toISOString().split('T')[0];
    console.log(`[cron-match-stats] resume from last_run ${state.last_run} → window ${dateFrom}..now`);
  } else {
    // Première run : 7 jours glissants (matchs récents)
    const d = new Date();
    d.setDate(d.getDate() - 7);
    dateFrom = d.toISOString().split('T')[0];
    console.log(`[cron-match-stats] first run → window ${dateFrom}..now (7 days)`);
  }

  const dateTo = new Date().toISOString().split('T')[0];

  // Open DB
  console.log(`[cron-match-stats] DB: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure schema exists
  db.exec(`CREATE TABLE IF NOT EXISTS match_stats_history (
    bsd_event_id TEXT PRIMARY KEY,
    bsd_league_id TEXT NOT NULL,
    season TEXT NOT NULL,
    match_date TEXT,
    home_team TEXT, away_team TEXT,
    home_team_id TEXT, away_team_id TEXT,
    home_score INTEGER, away_score INTEGER,
    home_score_ht INTEGER, away_score_ht INTEGER,
    home_xg REAL, away_xg REAL,
    home_shots INTEGER, away_shots INTEGER,
    home_sot INTEGER, away_sot INTEGER,
    home_shots_inside INTEGER, away_shots_inside INTEGER,
    home_blocked_shots INTEGER, away_blocked_shots INTEGER,
    home_corners INTEGER, away_corners INTEGER,
    home_possession REAL, away_possession REAL,
    home_big_chances INTEGER, away_big_chances INTEGER,
    home_big_chances_missed INTEGER, away_big_chances_missed INTEGER,
    home_passes INTEGER, away_passes INTEGER,
    home_pass_acc REAL, away_pass_acc REAL,
    home_yellow INTEGER, away_yellow INTEGER,
    home_fouls INTEGER, away_fouls INTEGER,
    home_offsides INTEGER, away_offsides INTEGER,
    home_touches_box INTEGER, away_touches_box INTEGER,
    home_final_third INTEGER, away_final_third INTEGER,
    home_woodwork INTEGER, away_woodwork INTEGER,
    home_goals_prevented REAL, away_goals_prevented REAL,
    home_xg_1h REAL, away_xg_1h REAL,
    home_xg_2h REAL, away_xg_2h REAL,
    home_corners_1h INTEGER, away_corners_1h INTEGER,
    home_corners_2h INTEGER, away_corners_2h INTEGER,
    home_shots_1h INTEGER, away_shots_1h INTEGER,
    home_shots_2h INTEGER, away_shots_2h INTEGER,
    odds_home REAL, odds_draw REAL, odds_away REAL,
    odds_over_15 REAL, odds_over_25 REAL, odds_over_35 REAL, odds_under_25 REAL,
    odds_btts_yes REAL, odds_btts_no REAL,
    weather_code INTEGER, temperature_c REAL, wind_speed REAL,
    travel_distance_km REAL, is_derby INTEGER, is_neutral INTEGER,
    referee TEXT, attendance INTEGER,
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  // Use INSERT OR REPLACE pour mise à jour des stats si déjà présent
  const upsertStmt = db.prepare(`INSERT OR REPLACE INTO match_stats_history (
    bsd_event_id, bsd_league_id, season, match_date,
    home_team, away_team, home_team_id, away_team_id,
    home_score, away_score, home_score_ht, away_score_ht,
    home_xg, away_xg,
    home_shots, away_shots, home_sot, away_sot,
    home_shots_inside, away_shots_inside, home_blocked_shots, away_blocked_shots,
    home_corners, away_corners, home_possession, away_possession,
    home_big_chances, away_big_chances, home_big_chances_missed, away_big_chances_missed,
    home_passes, away_passes, home_pass_acc, away_pass_acc,
    home_yellow, away_yellow, home_fouls, away_fouls,
    home_offsides, away_offsides, home_touches_box, away_touches_box,
    home_final_third, away_final_third, home_woodwork, away_woodwork,
    home_goals_prevented, away_goals_prevented,
    home_xg_1h, away_xg_1h, home_xg_2h, away_xg_2h,
    home_corners_1h, away_corners_1h, home_corners_2h, away_corners_2h,
    home_shots_1h, away_shots_1h, home_shots_2h, away_shots_2h,
    odds_home, odds_draw, odds_away,
    odds_over_15, odds_over_25, odds_over_35, odds_under_25,
    odds_btts_yes, odds_btts_no,
    weather_code, temperature_c, wind_speed,
    travel_distance_km, is_derby, is_neutral, referee, attendance
  ) VALUES (${new Array(77).fill('?').join(',')})`);

  const stats = { totalProcessed: 0, totalInserted: 0, totalUpdated: 0, totalWithStats: 0, errors: 0, leaguesProcessed: 0 };

  for (const leagueId of BSD_LEAGUE_IDS) {
    let offset = 0;
    let pageCount = 0;
    let inserted = 0;
    let updated = 0;
    let withStats = 0;

    try {
      while (true) {
        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
          league: String(leagueId),
          status: 'finished',
          limit: String(PAGE_LIMIT),
          offset: String(offset),
        });
        const res = await bsdFetchRetry(`/events/?${params.toString()}`);
        const results = res?.data?.results ?? res?.results ?? [];
        if (!results.length) break;
        pageCount++;

        for (const event of results) {
          const eid = String(event.id);
          const ls = event.live_stats || {};
          const h = extractSide(ls.home);
          const a = extractSide(ls.away);
          const h1 = extractHalfSide(ls.first_half?.home);
          const a1 = extractHalfSide(ls.first_half?.away);
          const h2 = extractHalfSide(ls.second_half?.home);
          const a2 = extractHalfSide(ls.second_half?.away);

          const homeXg = num(event.actual_home_xg) ?? h.xg;
          const awayXg = num(event.actual_away_xg) ?? a.xg;

          if (homeXg != null || h.shots != null || h.corners != null) withStats++;

          const rawDate = event.event_date || event.date || event.start_time || '';
          const matchDate = rawDate ? String(rawDate).split('T')[0] : '';

          // Calcul saison depuis la date du match
          const matchMonth = matchDate ? parseInt(matchDate.split('-')[1], 10) : 8;
          const matchYear = matchDate ? parseInt(matchDate.split('-')[0], 10) : 2025;
          const seasonLabel = matchMonth >= 8
            ? `${matchYear}-${matchYear + 1}`
            : `${matchYear - 1}-${matchYear}`;

          if (isDry) {
            console.log(`  [DRY] ${eid} | ${matchDate} | ${event.home_team} ${event.home_score}-${event.away_score} ${event.away_team} | xG ${homeXg}-${awayXg}`);
            continue;
          }

          // Vérifier si existe déjà
          const existing = db.prepare('SELECT bsd_event_id FROM match_stats_history WHERE bsd_event_id = ?').get(eid);

          upsertStmt.run(
            eid, String(leagueId), seasonLabel, matchDate,
            event.home_team || '', event.away_team || '',
            event.home_team_obj?.id != null ? String(event.home_team_obj.id) : null,
            event.away_team_obj?.id != null ? String(event.away_team_obj.id) : null,
            num(event.home_score), num(event.away_score),
            num(event.home_score_ht), num(event.away_score_ht),
            homeXg, awayXg,
            h.shots, a.shots, h.sot, a.sot,
            h.shotsInside, a.shotsInside, h.blocked, a.blocked,
            h.corners, a.corners, h.possession, a.possession,
            h.bigChances, a.bigChances, h.bigChancesMissed, a.bigChancesMissed,
            h.passes, a.passes, h.passAcc, a.passAcc,
            h.yellow, a.yellow, h.fouls, a.fouls,
            h.offsides, a.offsides, h.touchesBox, a.touchesBox,
            h.finalThird, a.finalThird, h.woodwork, a.woodwork,
            h.goalsPrevented, a.goalsPrevented,
            h1.xg, a1.xg, h2.xg, a2.xg,
            h1.corners, a1.corners, h1.shots, a1.shots,
            h2.corners, a2.corners, h2.shots, a2.shots,
            num(event.odds_home), num(event.odds_draw), num(event.odds_away),
            num(event.odds_over_15), num(event.odds_over_25), num(event.odds_over_35), num(event.odds_under_25),
            num(event.odds_btts_yes), num(event.odds_btts_no),
            num(event.weather_code), num(event.temperature_c), num(event.wind_speed),
            num(event.travel_distance_km),
            event.is_local_derby ? 1 : 0,
            event.is_neutral_ground ? 1 : 0,
            typeof event.referee === 'string' ? event.referee : (event.referee?.name ?? null),
            num(event.attendance)
          );

          if (existing) updated++;
          else inserted++;
        }

        if (results.length < PAGE_LIMIT) break;
        offset += PAGE_LIMIT;
        await pause(THROTTLE_MS);
      }

      if (pageCount > 0) {
        stats.leaguesProcessed++;
        const action = inserted > 0 ? `+${inserted}` : '';
        const upd = updated > 0 ? ` ~${updated}` : '';
        console.log(`[cron-match-stats] L${leagueId} : ${inserted} insérés, ${updated} mis à jour (${withStats} avec stats, ${pageCount}p)${action}${upd}`);
      }
      stats.totalProcessed += pageCount * PAGE_LIMIT;
      stats.totalInserted += inserted;
      stats.totalUpdated += updated;
      stats.totalWithStats += withStats;
    } catch (e) {
      stats.errors++;
      console.error(`[cron-match-stats] L${leagueId} ERROR: ${e.message}`);
    }
    await pause(THROTTLE_MS);
  }

  // Save state
  if (!isDry) saveState(state);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[cron-match-stats] === RÉSULTAT FINAL ===`);
  console.log(`[cron-match-stats] Ligues traitées : ${stats.leaguesProcessed}/${BSD_LEAGUE_IDS.length}`);
  console.log(`[cron-match-stats] Matchs insérés : ${stats.totalInserted}`);
  console.log(`[cron-match-stats] Matchs mis à jour : ${stats.totalUpdated}`);
  console.log(`[cron-match-stats] Matchs avec stats : ${stats.totalWithStats}`);
  console.log(`[cron-match-stats] Erreurs : ${stats.errors}`);
  console.log(`[cron-match-stats] Durée : ${elapsed}s`);
  console.log(`[cron-match-stats] State saved → ${STATE_FILE}`);

  db.close();
  process.exit(0);
})().catch(e => {
  console.error('[cron-match-stats] FATAL:', e.message);
  process.exit(1);
});
