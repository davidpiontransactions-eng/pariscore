#!/usr/bin/env node
/**
 * tools/build-tennis-sps-weekly.js — ETL SPS hebdomadaire
 *
 * Calcule le Surface PowerScore (SPS) des top 150 ATP & WTA
 * à partir de tennis_matches (Sackmann) + tennis_ta_cache (TennisAbstract).
 *
 * Usage:
 *   node tools/build-tennis-sps-weekly.js [--dry-run] [--limit=N]
 *
 * Exit:
 *   0 = OK    1 = fatal (DB)    2 = erreurs partielles
 */

var Database = require('better-sqlite3');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');

var ARGS = process.argv.slice(2);
var DRY_RUN = ARGS.indexOf('--dry-run') >= 0;
var limitIdx = ARGS.indexOf('--limit');
var PLAYER_LIMIT = limitIdx >= 0 ? parseInt(ARGS[limitIdx + 1], 10) || 150 : 150;

var SURFACES = ['Hard', 'Clay', 'Grass', 'Carpet'];
var TOURS = ['ATP', 'WTA'];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function ymdNDaysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function tnRankPts(oppRank) {
  if (oppRank && oppRank >= 1 && oppRank <= 10) return 3;
  if (oppRank && oppRank <= 50) return 2;
  if (oppRank && oppRank <= 100) return 1;
  return 0.5;
}

function normName(s) {
  if (!s) return '';
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getWeekTag() {
  var now = new Date();
  var d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + pad2(weekNo);
}

// ── Schéma ────────────────────────────────────────────────────────────────────

function initSchema() {
  db.exec(`CREATE TABLE IF NOT EXISTS tennis_sps_weekly (
    player_name TEXT NOT NULL,
    tour TEXT NOT NULL,
    surface TEXT NOT NULL,
    sps_score REAL,
    l5_pts REAL,
    l10_pts REAL,
    elo_norm REAL,
    win_rate REAL,
    form_factor REAL,
    surface_score REAL,
    elo_momentum REAL,
    fatigue REAL,
    recent_form REAL,
    minutes_45d REAL,
    surf_rank INTEGER,
    surf_total INTEGER,
    ps_rank INTEGER,
    ps_total INTEGER,
    sample INTEGER DEFAULT 0,
    take_set_rate REAL,
    sweep_rate REAL,
    ta_sample INTEGER,
    ta_source TEXT,
    serve_pct REAL,
    bp_pct REAL,
    computed_at INTEGER NOT NULL,
    week_tag TEXT NOT NULL,
    PRIMARY KEY (player_name, tour, surface, week_tag)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_spsw_tour_surf_score ON tennis_sps_weekly(tour, surface, sps_score DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_spsw_player ON tennis_sps_weekly(player_name, tour)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_spsw_week ON tennis_sps_weekly(week_tag)');

  // Colonnes TA supplémentaires (idempotent)
  try {
    var existingCols = new Set(db.prepare('PRAGMA table_info(tennis_sps_weekly)').all().map(function(c) { return c.name; }));
    var extraCols = [
      ['take_set_rate', 'REAL'],
      ['sweep_rate', 'REAL'],
      ['ta_sample', 'INTEGER'],
      ['ta_source', 'TEXT'],
      ['serve_pct', 'REAL'],
      ['bp_pct', 'REAL'],
    ];
    for (var i = 0; i < extraCols.length; i++) {
      if (!existingCols.has(extraCols[i][0])) {
        db.exec('ALTER TABLE tennis_sps_weekly ADD COLUMN ' + extraCols[i][0] + ' ' + extraCols[i][1]);
      }
    }
  } catch (e) {
    console.warn('[SPS-ETL] ALTER TA cols:', e.message);
  }
}

// ── Requêtes métier ────────────────────────────────────────────────────────────

function getTopPlayers(tour, limit) {
  return db.prepare(
    `SELECT e.player_id, e.player_name, MAX(e.elo) AS elo
     FROM tennis_elo e
     WHERE e.tour = ?
     GROUP BY e.player_id, e.player_name
     ORDER BY elo DESC
     LIMIT ?`
  ).all(tour, limit);
}

function getEloForSurface(playerId, tour, surface) {
  var row = db.prepare(
    'SELECT player_id, player_name, elo FROM tennis_elo WHERE player_id = ? AND tour = ? AND surface = ?'
  ).get(playerId, tour, surface);
  if (row) return row;
  return db.prepare(
    'SELECT player_id, player_name, elo FROM tennis_elo WHERE player_id = ? AND tour = ? AND surface = ?'
  ).get(playerId, tour, 'ALL');
}

function computeSPS(playerId, surface, eloRow) {
  var r = { l5_pts: null, l10_pts: null, sps_score: null,
            elo_norm: null, win_rate: null, form_factor: null,
            surface_score: null, elo_momentum: null, fatigue: null,
            recent_form: null, minutes_45d: null, sample: null };
  if (!playerId || !surface) return r;

  try {
    var rows = db.prepare(
      `SELECT winner_id, winner_rank, loser_rank, tourney_date FROM tennis_matches
       WHERE surface = ? AND (winner_id = ? OR loser_id = ?)
       ORDER BY tourney_date DESC, match_num DESC LIMIT 10`
    ).all(surface, playerId, playerId);

    if (rows.length) {
      var l5 = 0, l10 = 0;
      rows.forEach(function(m, i) {
        var won = m.winner_id === playerId;
        var pts = won ? tnRankPts(won ? m.loser_rank : m.winner_rank) : 0;
        l10 += pts; if (i < 5) l5 += pts;
      });
      r.l5_pts = Math.round(l5 * 10) / 10;
      r.l10_pts = Math.round(l10 * 10) / 10;

      // WinRate 52 sem. surface
      var cut364 = ymdNDaysAgo(364);
      var wr = db.prepare(
        `SELECT SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS wins, COUNT(*) AS tot
         FROM tennis_matches
         WHERE surface = ? AND tourney_date >= ? AND (winner_id = ? OR loser_id = ?)`
      ).get(playerId, surface, cut364, playerId, playerId);
      var winRate = (wr && wr.tot > 0) ? wr.wins / wr.tot : 0;
      var eloNorm = eloRow && eloRow.elo
        ? Math.max(0, Math.min(1, (eloRow.elo - 1500) / 900)) : 0;
      var formFactor = Math.max(0, Math.min(1, l10 / 30));

      // Pondérations dynamiques par surface
      var surfaceScore;
      var s = String(surface).toLowerCase();
      if (s === 'grass') {
        surfaceScore = Math.min(1, 0.50 * eloNorm + 0.35 * winRate + 0.15 * formFactor);
      } else if (s === 'clay') {
        surfaceScore = Math.min(1, 0.35 * eloNorm + 0.40 * winRate + 0.25 * formFactor);
      } else {
        surfaceScore = Math.min(1, 0.45 * eloNorm + 0.35 * winRate + 0.20 * formFactor);
      }

      // Momentum : winRate 30j / winRate 52sem
      var cut30 = ymdNDaysAgo(30);
      var recentWr = db.prepare(
        `SELECT SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS wins, COUNT(*) AS tot
         FROM tennis_matches
         WHERE surface = ? AND tourney_date >= ? AND (winner_id = ? OR loser_id = ?)`
      ).get(playerId, surface, cut30, playerId, playerId);
      var recentRate = (recentWr && recentWr.tot > 0) ? recentWr.wins / recentWr.tot : -1;
      var eloMomentum = recentRate >= 0 && winRate > 0
        ? Math.min(1, Math.max(0, recentRate / winRate)) : 0.5;

      // Fatigue : minutes 45j
      var cut45 = ymdNDaysAgo(45);
      var fatRow = db.prepare(
        `SELECT COALESCE(SUM(minutes), 0) AS total_min
         FROM tennis_matches
         WHERE (winner_id = ? OR loser_id = ?) AND tourney_date >= ?`
      ).get(playerId, playerId, cut45);
      var minutes45d = fatRow ? fatRow.total_min : 0;
      var fatigue = Math.min(1, minutes45d / 720);

      var recentForm = Math.min(1, 0.60 * eloMomentum + 0.40 * (1 - fatigue));

      // SPS final 70/30
      var power = Math.round(100 * (0.70 * surfaceScore + 0.30 * recentForm));

      r.elo_norm = Math.round(eloNorm * 1000) / 1000;
      r.win_rate = Math.round(winRate * 1000) / 1000;
      r.form_factor = Math.round(formFactor * 1000) / 1000;
      r.surface_score = Math.round(surfaceScore * 1000) / 1000;
      r.elo_momentum = Math.round(eloMomentum * 1000) / 1000;
      r.fatigue = Math.round(fatigue * 1000) / 1000;
      r.recent_form = Math.round(recentForm * 1000) / 1000;
      r.minutes_45d = Math.round(minutes45d * 10) / 10;
      r.sample = rows.length;
      r.sps_score = Math.max(0, Math.min(100, power));
    } else {
      r.l5_pts = 0;
      r.l10_pts = 0;
      r.sample = 0;
    }
  } catch (e) {
    console.warn('[SPS-ETL] computeSPS error player=' + playerId + ' surface=' + surface + ': ' + e.message);
  }
  return r;
}

function getTaCache(playerName, tour, surface) {
  try {
    var nk = normName(playerName);
    return db.prepare(
      `SELECT take_set_rate, sweep_rate, sample, source
       FROM tennis_ta_cache WHERE name_key = ? AND tour = ? AND surface = ?`
    ).get(nk, tour, surface);
  } catch (e) {
    return null;
  }
}

function computeRanks(tour, weekTag) {
  for (var si = 0; si < SURFACES.length; si++) {
    var surface = SURFACES[si];

    // Surf rank : classement par sps_score DESC
    var surfRows = db.prepare(
      `SELECT player_name FROM tennis_sps_weekly
       WHERE tour = ? AND surface = ? AND week_tag = ? AND sps_score IS NOT NULL
       ORDER BY sps_score DESC`
    ).all(tour, surface, weekTag);

    var surfTotal = surfRows.length;
    var surfRankStmt = db.prepare(
      `UPDATE tennis_sps_weekly SET surf_rank = ?, surf_total = ?
       WHERE player_name = ? AND tour = ? AND surface = ? AND week_tag = ?`
    );
    for (var i = 0; i < surfRows.length; i++) {
      surfRankStmt.run(i + 1, surfTotal, surfRows[i].player_name, tour, surface, weekTag);
    }

    // PS rank : power rank (même logique, tri par sps_score DESC)
    var psRows = db.prepare(
      `SELECT player_name FROM tennis_sps_weekly
       WHERE tour = ? AND surface = ? AND week_tag = ? AND sps_score IS NOT NULL
       ORDER BY sps_score DESC`
    ).all(tour, surface, weekTag);

    var psTotal = psRows.length;
    var psRankStmt = db.prepare(
      `UPDATE tennis_sps_weekly SET ps_rank = ?, ps_total = ?
       WHERE player_name = ? AND tour = ? AND surface = ? AND week_tag = ?`
    );
    for (var i = 0; i < psRows.length; i++) {
      psRankStmt.run(i + 1, psTotal, psRows[i].player_name, tour, surface, weekTag);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  var t0 = Date.now();
  var dbPath = DB_PATH;

  try {
    db = new Database(dbPath, { readonly: false });
    db.pragma('journal_mode = WAL');
  } catch (e) {
    console.error('[SPS-ETL] FATAL: Cannot open database ' + dbPath + ': ' + e.message);
    process.exit(1);
  }

  initSchema();

  var weekTag = getWeekTag();
  var computedAt = Math.floor(Date.now() / 1000);
  var totalUpserted = 0;
  var totalErrors = 0;
  var totalSkipped = 0;

  console.log('[SPS-ETL] D\u00e9marrage \u2014 week_tag=' + weekTag + ' limit=' + PLAYER_LIMIT + (DRY_RUN ? ' (DRY RUN)' : ''));

  var upsert = db.prepare(
    `INSERT OR REPLACE INTO tennis_sps_weekly
     (player_name, tour, surface, sps_score, l5_pts, l10_pts,
      elo_norm, win_rate, form_factor, surface_score,
      elo_momentum, fatigue, recent_form, minutes_45d,
      sample, take_set_rate, sweep_rate, ta_sample, ta_source,
      computed_at, week_tag)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  for (var ti = 0; ti < TOURS.length; ti++) {
    var tour = TOURS[ti];
    var players = getTopPlayers(tour, PLAYER_LIMIT);
    console.log('[SPS-ETL] ' + tour + ' \u2014 ' + players.length + ' joueurs');

    for (var pi = 0; pi < players.length; pi++) {
      var p = players[pi];
      var pid = p.player_id;
      var pname = p.player_name;
      if (!pid || !pname) { totalSkipped++; continue; }

      for (var si = 0; si < SURFACES.length; si++) {
        var surface = SURFACES[si];
        var eloRow = getEloForSurface(pid, tour, surface);
        var sps = computeSPS(pid, surface, eloRow);

        // Skip si aucun match sur cette surface
        if (sps.sample === 0 && sps.l5_pts === 0 && sps.sps_score == null) {
          totalSkipped++;
          continue;
        }

        var ta = getTaCache(pname, tour, surface);

        if (DRY_RUN) {
          totalUpserted++;
          if (totalUpserted <= 5) {
            console.log('[SPS-ETL] [DRY] ' + pname + ' | ' + tour + ' | ' + surface + ' \u2192 sps=' + sps.sps_score);
          }
        } else {
          try {
            upsert.run(
              pname, tour, surface,
              sps.sps_score, sps.l5_pts, sps.l10_pts,
              sps.elo_norm, sps.win_rate, sps.form_factor, sps.surface_score,
              sps.elo_momentum, sps.fatigue, sps.recent_form, sps.minutes_45d,
              sps.sample,
              ta ? ta.take_set_rate : null,
              ta ? ta.sweep_rate : null,
              ta ? ta.sample : null,
              ta ? ta.source : null,
              computedAt, weekTag
            );
            totalUpserted++;
          } catch (e) {
            console.warn('[SPS-ETL] UPSERT error ' + pname + ' ' + surface + ': ' + e.message);
            totalErrors++;
          }
        }
      } // end surfaces

      // Progression tous les 10 joueurs
      if ((pi + 1) % 10 === 0) {
        console.log('[SPS-ETL] ... ' + tour + ' ' + (pi + 1) + '/' + players.length + ' joueurs \u2014 ' + totalUpserted + ' upserted, ' + totalErrors + ' errors');
      }
    } // end players

    if (!DRY_RUN) {
      console.log('[SPS-ETL] Calcul des ranks pour ' + tour + '...');
      computeRanks(tour, weekTag);
    }
  } // end tours

  var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('[SPS-ETL] Termin\u00e9 \u2014 ' + totalUpserted + ' upsert\u00e9s, ' + totalSkipped + ' skip, ' + totalErrors + ' erreurs, ' + elapsed + 's');

  db.close();

  if (totalErrors > 0 && totalUpserted === 0) process.exit(1);
  if (totalErrors > 0) process.exit(2);
  process.exit(0);
}

main();
