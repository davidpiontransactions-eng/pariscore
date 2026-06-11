#!/usr/bin/env node
'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname.replace(/[\\/]tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const DRY_RUN = process.argv.includes('--dry-run');

const TENNIS_ELO_INITIAL = 1500;
const TENNIS_ELO_KBASE_GENERAL = 250;
const TENNIS_ELO_KBASE_SURFACE = 200;
const TENNIS_ELO_SURFACES = ['Hard', 'Clay', 'Grass', 'Carpet'];

function eloExpected(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function eloUpdate(eloWinner, eloLoser, K) {
  const expW = eloExpected(eloWinner, eloLoser);
  return {
    winner: eloWinner + K * (1 - expW),
    loser: eloLoser - K * (1 - expW),
  };
}

function eloKExp(matches, base) {
  return base / Math.pow((matches || 0) + 5, 0.4);
}

function parseScoreGames(score) {
  if (!score) return null;
  const sets = String(score).replace(/\([^)]*\)/g, '').trim().split(/\s+/);
  let w = 0, l = 0, valid = 0;
  for (const s of sets) {
    const mm = s.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!mm) continue;
    w += parseInt(mm[1], 10); l += parseInt(mm[2], 10); valid++;
  }
  return valid ? { w, l } : null;
}

function eloMov(score, eloDiffWinnerPersp) {
  const g = parseScoreGames(score);
  if (!g) return 1;
  const diff = Math.max(1, Math.abs(g.w - g.l));
  const corr = 2.2 / (eloDiffWinnerPersp * 0.001 + 2.2);
  const mult = Math.log(diff + 1) * corr;
  return Math.max(0.5, Math.min(mult, 1.8));
}

function rankToElo(rank) {
  if (!rank || rank < 1) return TENNIS_ELO_INITIAL;
  const e = 2200 - 130 * Math.log(rank);
  return Math.max(1400, Math.min(2350, e));
}

function ymdToDays(ymd) {
  if (!ymd) return null;
  const s = String(ymd);
  if (s.length < 8) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8);
  const t = Date.UTC(y, (mo || 1) - 1, d || 1);
  return Number.isFinite(t) ? Math.floor(t / 86400000) : null;
}

function eloInactivityRegress(elo, lastYmd, curYmd) {
  const a = ymdToDays(lastYmd), b = ymdToDays(curYmd);
  if (a == null || b == null) return elo;
  const gap = b - a;
  if (gap <= 365) return elo;
  const r = Math.max(0.5, 1 - (gap - 365) / 1825);
  return TENNIS_ELO_INITIAL + (elo - TENNIS_ELO_INITIAL) * r;
}

function main() {
  const t0 = Date.now();

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[Elo] FATAL: DB introuvable: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  console.log(`[Elo] DB: ${DB_PATH}`);
  console.log(`[Elo] Mode: ${DRY_RUN ? 'DRY-RUN (lecture seule)' : 'ÉCRITURE'}`);
  console.log('');

  // 1. Read tennis_matches
  const rows = db.prepare(`
    SELECT tour, surface, tourney_date, score,
           winner_id, winner_name, winner_rank,
           loser_id, loser_name, loser_rank
    FROM tennis_matches
    WHERE winner_id IS NOT NULL AND loser_id IS NOT NULL
      AND tourney_date IS NOT NULL
    ORDER BY tourney_date ASC, tourney_id ASC, match_num ASC
  `).all();

  console.log(`[Elo] ${rows.length} matchs lus depuis tennis_matches`);
  if (rows.length === 0) {
    console.log('[Elo] Aucun match à traiter — sortie.');
    db.close();
    return;
  }

  // 2. Compute Elo
  const elos = new Map();
  let processed = 0;

  for (const m of rows) {
    const tour = m.tour;
    if (!tour) continue;

    const wName = m.winner_name || null;
    const lName = m.loser_name || null;
    const wId = m.winner_id;
    const lId = m.loser_id;
    if (wId == null || lId == null) continue;

    const surface = m.surface && TENNIS_ELO_SURFACES.includes(m.surface) ? m.surface : null;
    const ymd = m.tourney_date;

    // ── Blended (ALL) ──
    const allKeyW = `${tour}|${wId}|ALL`;
    const allKeyL = `${tour}|${lId}|ALL`;
    const allW = elos.get(allKeyW) || { elo: rankToElo(m.winner_rank), matches: 0, lastDate: 0, name: wName };
    const allL = elos.get(allKeyL) || { elo: rankToElo(m.loser_rank), matches: 0, lastDate: 0, name: lName };
    const aWElo = eloInactivityRegress(allW.elo, allW.lastDate, ymd);
    const aLElo = eloInactivityRegress(allL.elo, allL.lastDate, ymd);
    const aK = eloKExp(Math.min(allW.matches, allL.matches), TENNIS_ELO_KBASE_GENERAL)
             * eloMov(m.score, aWElo - aLElo);
    const allRes = eloUpdate(aWElo, aLElo, aK);
    elos.set(allKeyW, { elo: allRes.winner, matches: allW.matches + 1, lastDate: ymd, name: wName || allW.name });
    elos.set(allKeyL, { elo: allRes.loser, matches: allL.matches + 1, lastDate: ymd, name: lName || allL.name });

    if (surface) {
      const sKeyW = `${tour}|${wId}|${surface}`;
      const sKeyL = `${tour}|${lId}|${surface}`;
      const sW = elos.get(sKeyW) || { elo: rankToElo(m.winner_rank), matches: 0, lastDate: 0, name: wName };
      const sL = elos.get(sKeyL) || { elo: rankToElo(m.loser_rank), matches: 0, lastDate: 0, name: lName };
      const sWElo = eloInactivityRegress(sW.elo, sW.lastDate, ymd);
      const sLElo = eloInactivityRegress(sL.elo, sL.lastDate, ymd);
      const sK = eloKExp(Math.min(sW.matches, sL.matches), TENNIS_ELO_KBASE_SURFACE)
               * eloMov(m.score, sWElo - sLElo);
      const sRes = eloUpdate(sWElo, sLElo, sK);
      elos.set(sKeyW, { elo: sRes.winner, matches: sW.matches + 1, lastDate: ymd, name: wName || sW.name });
      elos.set(sKeyL, { elo: sRes.loser, matches: sL.matches + 1, lastDate: ymd, name: lName || sL.name });
    }
    processed++;
  }

  // 3. Stats before write
  const bySurface = {};
  for (const key of elos.keys()) {
    const s = key.split('|')[2];
    bySurface[s] = (bySurface[s] || 0) + 1;
  }

  console.log('');
  console.log(`[Elo] Matchs traités : ${processed}`);
  console.log(`[Elo] Ratings calculés : ${elos.size}`);
  console.log('[Elo] Par surface :');
  const sortedSurfaces = Object.keys(bySurface).sort();
  for (const s of sortedSurfaces) {
    console.log(`       ${s.padEnd(10)} ${bySurface[s]}`);
  }

  // 4. Write to DB (unless dry-run)
  if (!DRY_RUN) {
    db.exec('DELETE FROM tennis_elo');
    const stmt = db.prepare(`INSERT OR REPLACE INTO tennis_elo
      (player_id, player_name, tour, surface, elo, matches_count, last_match_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const now = Math.floor(Date.now() / 1000);
    const tx = db.transaction(() => {
      for (const [key, val] of elos.entries()) {
        const parts = key.split('|');
        const tour = parts[0];
        const playerId = parseInt(parts[1], 10);
        const surface = parts[2];
        stmt.run(playerId, val.name, tour, surface, val.elo, val.matches, val.lastDate || null, now);
      }
    });
    tx();
    console.log('');
    console.log(`[Elo] ✓ ${elos.size} ratings écrits dans tennis_elo`);
  }

  const elapsed = Date.now() - t0;
  console.log('');
  console.log(`[Elo] Terminé en ${elapsed}ms${DRY_RUN ? ' [DRY-RUN — DB non modifiée]' : ''}`);

  db.close();
}

main();
