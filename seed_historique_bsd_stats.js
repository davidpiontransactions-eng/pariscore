/**
 * USAGE:
 *   node seed_historique_bsd_stats.js                    # tout : standings + match stats (toutes ligues, saison 2025-26)
 *   node seed_historique_bsd_stats.js --all-seasons      # inclut 2023-24 + 2024-25 (scores only, ⚠ fixtures fantômes possibles)
 *   node seed_historique_bsd_stats.js --mode=matches     # uniquement stats matchs (match_stats_history)
 *   node seed_historique_bsd_stats.js --mode=standings   # uniquement classements (team_season_stats)
 *   node seed_historique_bsd_stats.js --dry              # dry run (log uniquement, pas d'insert)
 *   node seed_historique_bsd_stats.js --league=1         # une seule league BSD ID
 *   node seed_historique_bsd_stats.js --max-seasons=10   # profondeur standings (défaut 5)
 *
 * ETL bd rm3d — stats avancées BSD pour le moteur quant :
 *
 * 1. match_stats_history : payload /events/ liste (status=finished) — AUCUN appel
 *    par match nécessaire, live_stats complet embarqué (xG, tirs, corners, big
 *    chances, possession, splits 1re/2e mi-temps) + cotes closing (1N2, O/U,
 *    BTTS) + contexte (météo, arbitre, distance déplacement, derby).
 *
 * 2. team_season_stats : /leagues/{id}/standings/?season={sid} — classements
 *    historiques par saison (W/D/L, GF/GA, pts, forme). xGF/xGA renseignés
 *    uniquement saison courante côté BSD (0 sinon) — l'agrégat xG historique
 *    par équipe se reconstruit depuis match_stats_history.
 *
 * Pattern hérité de seed_historique_bsd_corners.js (bd sc0o / v12.73) avec fix
 * pagination : suit limit/offset jusqu'à épuisement (tail > 1 page).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────────
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[BSD-STATS-ETL] .env introuvable — abandon');
  process.exit(1);
}

const BSD_API_KEY = ENV.BSD_API_KEY;
if (!BSD_API_KEY) {
  console.error('[BSD-STATS-ETL] BSD_API_KEY absent du .env — abandon');
  process.exit(1);
}
const BSD_BASE_URL = 'https://sports.bzzoiro.com/api';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db');
const THROTTLE_MS = 300;
const PAGE_LIMIT = 100;

// Ligues BSD depuis bsd_config.json mapping (même liste que corners ETL)
const BSD_LEAGUE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 17, 18, 19, 20,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 38, 39, 40, 41, 42,
  43, 44, 46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69
];

// Coverage vérifiée 2026-06-11 (probe 6 fenêtres) : live_stats + xG + splits
// mi-temps présents UNIQUEMENT à partir de la saison 2025-26. Les saisons
// antérieures renvoient des events score-only ET contiennent des fixtures
// fantômes (ex. "Man Utd vs Bolton" en PL 2023-24) → défaut = 2025-26 seul.
// --all-seasons pour ingérer quand même 2023-24 + 2024-25 (scores/météo only).
const SEASONS_RECENT = [
  { start: '2025-08-01', end: '2026-07-31', label: '2025-2026' },
];
const SEASONS_OLD = [
  { start: '2023-08-01', end: '2024-07-31', label: '2023-2024' },
  { start: '2024-08-01', end: '2025-07-31', label: '2024-2025' },
];
const SEASONS = process.argv.includes('--all-seasons')
  ? [...SEASONS_OLD, ...SEASONS_RECENT]
  : SEASONS_RECENT;

// ── CLI args ──────────────────────────────────────────────────────────────────
const isDry = process.argv.includes('--dry');
const modeArg = process.argv.find(a => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'all'; // all | matches | standings
const leagueArg = process.argv.find(a => a.startsWith('--league'));
const targetLeague = leagueArg ? parseInt(leagueArg.split('=')[1], 10) : null;
const maxSeasonsArg = process.argv.find(a => a.startsWith('--max-seasons='));
const MAX_STANDINGS_SEASONS = maxSeasonsArg ? parseInt(maxSeasonsArg.split('=')[1], 10) : 5;

const leaguesToProcess = targetLeague !== null ? [targetLeague] : BSD_LEAGUE_IDS;

console.log(`[BSD-STATS-ETL] mode=${mode} | ligues=${leaguesToProcess.length} | dry=${isDry}`);

// ── BSD Fetch ────────────────────────────────────────────────────────────────
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
          reject(new Error('JSON parse error: ' + e.message + ' | data: ' + data.slice(0, 200)));
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

const pause = ms => new Promise(r => setTimeout(r, ms));
const num = v => (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);

// ── Schémas ───────────────────────────────────────────────────────────────────
function initSchema(db) {
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_msh_teams ON match_stats_history(home_team, away_team)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_msh_date ON match_stats_history(match_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_msh_league_season ON match_stats_history(bsd_league_id, season)`);

  db.exec(`CREATE TABLE IF NOT EXISTS team_season_stats (
    bsd_league_id TEXT NOT NULL,
    season_id TEXT NOT NULL,
    season_name TEXT,
    season_year INTEGER,
    is_current INTEGER DEFAULT 0,
    team_id TEXT NOT NULL,
    team_name TEXT,
    position INTEGER,
    played INTEGER, won INTEGER, drawn INTEGER, lost INTEGER,
    gf INTEGER, ga INTEGER, gd INTEGER, pts INTEGER,
    xgf REAL, xga REAL, xgd REAL, xg_games INTEGER,
    form TEXT,
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (bsd_league_id, season_id, team_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tss_team ON team_season_stats(team_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tss_year ON team_season_stats(season_year)`);
}

// ── Extraction match ──────────────────────────────────────────────────────────
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

// ── ETL 1 : match stats depuis /events/ liste paginée ────────────────────────
async function runMatches(db, stats) {
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO match_stats_history (
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

  const existing = new Set(
    db.prepare(`SELECT bsd_event_id FROM match_stats_history`).all().map(r => r.bsd_event_id)
  );
  console.log(`[BSD-STATS-ETL] matches — ${existing.size} events déjà en base (resume-safe)`);

  for (const leagueId of leaguesToProcess) {
    for (const season of SEASONS) {
      let offset = 0;
      let pageCount = 0;
      let inserted = 0;
      let withStats = 0;
      try {
        // Pagination tail complète (fix v12.73 : ne jamais s'arrêter à la page 1)
        while (true) {
          const params = new URLSearchParams({
            date_from: season.start,
            date_to: season.end,
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
            if (existing.has(eid)) continue;
            existing.add(eid);

            const ls = event.live_stats || {};
            const h = extractSide(ls.home);
            const a = extractSide(ls.away);
            const h1 = extractHalfSide(ls.first_half?.home);
            const a1 = extractHalfSide(ls.first_half?.away);
            const h2 = extractHalfSide(ls.second_half?.home);
            const a2 = extractHalfSide(ls.second_half?.away);

            // xG : champ top-level prioritaire, fallback live_stats
            const homeXg = num(event.actual_home_xg) ?? h.xg;
            const awayXg = num(event.actual_away_xg) ?? a.xg;

            if (homeXg != null || h.shots != null || h.corners != null) withStats++;

            const rawDate = event.event_date || event.date || event.start_time || '';
            const matchDate = rawDate ? String(rawDate).split('T')[0] : '';

            if (isDry) {
              console.log(`  [DRY] ${eid} | ${matchDate} | ${event.home_team} ${event.home_score}-${event.away_score} ${event.away_team} | xG ${homeXg}-${awayXg} | corners ${h.corners}-${a.corners} | shots ${h.shots}-${a.shots}`);
            } else {
              insertStmt.run(
                eid, String(leagueId), season.label, matchDate,
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
                h1.corners, a1.corners, h2.corners, a2.corners,
                h1.shots, a1.shots, h2.shots, a2.shots,
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
              inserted++;
            }
          }

          if (results.length < PAGE_LIMIT) break;
          offset += PAGE_LIMIT;
          await pause(THROTTLE_MS);
        }
        if (pageCount > 0) {
          console.log(`[BSD-STATS-ETL] L${leagueId} | ${season.label} : ${inserted} insérés (${withStats} avec stats, ${pageCount}p)`);
        }
        stats.matchesInserted += inserted;
        stats.matchesWithStats += withStats;
      } catch (e) {
        stats.errors++;
        console.error(`[BSD-STATS-ETL] L${leagueId} | ${season.label} ERROR: ${e.message}`);
      }
      await pause(THROTTLE_MS);
    }
  }
}

// ── ETL 2 : standings historiques par saison ─────────────────────────────────
async function runStandings(db, stats) {
  const upsertStmt = db.prepare(`INSERT OR REPLACE INTO team_season_stats (
    bsd_league_id, season_id, season_name, season_year, is_current,
    team_id, team_name, position,
    played, won, drawn, lost, gf, ga, gd, pts,
    xgf, xga, xgd, xg_games, form
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (const leagueId of leaguesToProcess) {
    try {
      const seasonsRes = await bsdFetchRetry(`/seasons/?league=${leagueId}`);
      let seasons = seasonsRes?.data?.results ?? seasonsRes?.results ?? seasonsRes?.seasons ?? [];
      if (!Array.isArray(seasons)) seasons = [];
      // Plus récentes d'abord, profondeur limitée
      seasons.sort((x, y) => (y.year ?? 0) - (x.year ?? 0));
      const targets = seasons.slice(0, MAX_STANDINGS_SEASONS);
      if (!targets.length) {
        console.log(`[BSD-STATS-ETL] standings L${leagueId} : aucune saison`);
        await pause(THROTTLE_MS);
        continue;
      }

      for (const season of targets) {
        try {
          const res = await bsdFetchRetry(`/leagues/${leagueId}/standings/?season=${season.id}`);
          const rows = res?.data?.standings ?? res?.standings ?? res?.data?.results ?? res?.results ?? [];
          if (!Array.isArray(rows) || !rows.length) { await pause(THROTTLE_MS); continue; }

          let count = 0;
          for (const r of rows) {
            const teamName = r.team_name ?? r.team ?? '';
            const teamId = r.team_id != null ? String(r.team_id) : teamName;
            if (!teamId) continue;
            if (isDry) {
              if (count < 3) console.log(`  [DRY] L${leagueId} S${season.id} #${r.position} ${teamName} pts=${r.pts} xgf=${r.xgf}`);
            } else {
              upsertStmt.run(
                String(leagueId), String(season.id), season.name ?? '', num(season.year), season.is_current ? 1 : 0,
                teamId, teamName, num(r.position),
                num(r.played), num(r.won), num(r.drawn), num(r.lost),
                num(r.gf), num(r.ga), num(r.gd), num(r.pts),
                num(r.xgf), num(r.xga), num(r.xgd), num(r.xg_games),
                r.form ?? null
              );
            }
            count++;
          }
          stats.standingsRows += count;
          console.log(`[BSD-STATS-ETL] standings L${leagueId} | ${season.name ?? season.id} : ${count} équipes`);
        } catch (e) {
          stats.errors++;
          console.error(`[BSD-STATS-ETL] standings L${leagueId} S${season.id} ERROR: ${e.message}`);
        }
        await pause(THROTTLE_MS);
      }
    } catch (e) {
      stats.errors++;
      console.error(`[BSD-STATS-ETL] standings L${leagueId} seasons ERROR: ${e.message}`);
      await pause(THROTTLE_MS);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('[BSD-STATS-ETL] DB:', DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema(db);

  const stats = { matchesInserted: 0, matchesWithStats: 0, standingsRows: 0, errors: 0 };

  if (mode === 'all' || mode === 'standings') await runStandings(db, stats);
  if (mode === 'all' || mode === 'matches') await runMatches(db, stats);

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log('\n[BSD-STATS-ETL] === RÉSULTAT FINAL ===');
  console.log(`[BSD-STATS-ETL] match_stats_history insérés : ${stats.matchesInserted} (${stats.matchesWithStats} avec stats)`);
  console.log(`[BSD-STATS-ETL] team_season_stats rows : ${stats.standingsRows}`);
  console.log(`[BSD-STATS-ETL] Erreurs : ${stats.errors}`);
  console.log(`[BSD-STATS-ETL] Durée : ${mins} min`);
  db.close();
}

main().catch(e => {
  console.error('[BSD-STATS-ETL] FATAL:', e);
  process.exit(1);
});
