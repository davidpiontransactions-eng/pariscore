#!/usr/bin/env node
/**
 * cron-compute-predictions.js — Calcule automatiquement les prédictions
 * pour les matchs à venir via l'API BSD (même pattern que cron_refresh_match_stats).
 *
 * Usage:
 *   node scripts/cron-compute-predictions.js
 *   node scripts/cron-compute-predictions.js --dry
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {}

const BSD_API_KEY = ENV.BSD_API_KEY;
const BSD_BASE_URL = ENV.BSD_BASE_URL || 'https://sports.bzzoiro.com/api';
const PREDICTIONS_BASE = ENV.PREDICTIONS_BASE_URL || 'http://localhost:3005';
const isDry = process.argv.includes('--dry');

const pause = ms => new Promise(r => setTimeout(r, ms));

const httpMod = require('http');
const httpsMod = require('https');
const Database = require('better-sqlite3');

// Top ligues pour les prédictions
const BSD_LEAGUE_IDS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20];

// Estimer Elo depuis les cotes (implied probability → Elo relatif)
function eloFromOdds(oddsH, oddsA) {
  if (!oddsH || !oddsA) return { home: 1500, away: 1500 };
  const pH = 1 / oddsH;
  const pA = 1 / oddsA;
  const total = pH + pA;
  const normH = pH / total;
  // Elo diff = -400 * log10(1/expected - 1)
  const expected = Math.max(0.05, Math.min(0.95, normH));
  const eloDiff = -400 * Math.log10((1 - expected) / expected);
  return { home: Math.round(1500 + eloDiff / 2), away: Math.round(1500 - eloDiff / 2) };
}

// Chercher forme récente dans match_stats_history
function getTeamForm(db, teamName, limit = 5) {
  if (!teamName || !db) return null;
  const rows = db.prepare(`
    SELECT home_team, away_team, home_score, away_score, match_date
    FROM match_stats_history
    WHERE (home_team = ? OR away_team = ?) AND match_date IS NOT NULL
    ORDER BY match_date DESC
    LIMIT ?
  `).all(teamName, teamName, limit);

  if (rows.length < 3) return null;

  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  for (const r of rows) {
    const isHome = r.home_team === teamName;
    const gf = isHome ? r.home_score : r.away_score;
    const ga = isHome ? r.away_score : r.home_score;
    goalsFor += gf || 0;
    goalsAgainst += ga || 0;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }

  return {
    ppg: (wins * 3 + draws) / rows.length,
    wins, draws, losses,
    goalsPerGame: goalsFor / rows.length,
    goalsConcededPerGame: goalsAgainst / rows.length,
    matches: rows.length,
  };
}

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
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function computePrediction(matchData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(matchData);
    const url = new URL('/api/v1/predictions/compute', PREDICTIONS_BASE);
    const mod = url.protocol === 'https:' ? httpsMod : httpMod;
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`[cron-compute-predictions] start at ${new Date().toISOString()}`);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Open match_stats_history for form lookups
  let db = null;
  try {
    const legacyDbPath = path.join(ROOT, 'pariscore.db');
    if (fs.existsSync(legacyDbPath)) {
      db = new Database(legacyDbPath, { readonly: true });
      console.log('[cron-compute-predictions] Opened pariscore.db for form lookups');
    }
  } catch (e) {
    console.warn('[cron-compute-predictions] Could not open DB for form:', e.message);
  }

  const events = [];
  const seenIds = new Set();

  for (const leagueId of BSD_LEAGUE_IDS) {
    try {
      const params = new URLSearchParams({
        league_id: String(leagueId),
        date_from: today,
        date_to: tomorrow,
        page_size: '50'
      });
      const res = await bsdFetch(`/events/?${params.toString()}`);
      const results = res?.data?.results ?? res?.results ?? [];
      for (const event of results) {
        const eid = String(event.id);
        // Only upcoming (no score yet) + dedup
        if (event.home_score == null && event.away_score == null && !seenIds.has(eid)) {
          seenIds.add(eid);
          events.push(event);
        }
      }
      await pause(300);
    } catch (e) {
      console.error(`[cron-compute-predictions] L${leagueId} error: ${e.message}`);
    }
  }

  console.log(`[cron-compute-predictions] Found ${events.length} upcoming events`);

  let computed = 0;
  let errors = 0;

  for (const event of events) {
    const matchId = `bsd-${event.id}`;

    // Estimate xG and Elo from odds
    const oddsH = event.odds_home ? Number(event.odds_home) : null;
    const oddsD = event.odds_draw ? Number(event.odds_draw) : null;
    const oddsA = event.odds_away ? Number(event.odds_away) : null;
    const xgH = oddsH ? Math.round((1 / oddsH * 2.5) * 100) / 100 : undefined;
    const xgA = oddsA ? Math.round((1 / oddsA * 2.5) * 100) / 100 : undefined;

    // Elo from odds (implied probability)
    const elo = eloFromOdds(oddsH, oddsA);

    // Team form from history
    const formH = getTeamForm(db, event.home_team, 5);
    const formA = getTeamForm(db, event.away_team, 5);

    // Adjust Elo with form (±50 based on PPG)
    if (formH) elo.home += Math.round((formH.ppg - 1.3) * 50);
    if (formA) elo.away += Math.round((formA.ppg - 1.3) * 50);

    const matchData = {
      matchId,
      homeTeam: event.home_team || 'Home',
      awayTeam: event.away_team || 'Away',
      homeXg: xgH,
      awayXg: xgA,
      homeElo: elo.home,
      awayElo: elo.away,
    };

    if (isDry) {
      const formStrH = formH ? ` PPG=${formH.ppg.toFixed(1)} W${formH.wins}D${formH.draws}L${formH.losses}` : '';
      const formStrA = formA ? ` PPG=${formA.ppg.toFixed(1)} W${formA.wins}D${formA.draws}L${formA.losses}` : '';
      console.log(`  [DRY] ${matchData.homeTeam} vs ${matchData.awayTeam} | Elo: ${elo.home}-${elo.away} | xG: ${xgH ?? 'N/A'}-${xgA ?? 'N/A'}${formStrH}${formStrA}`);
      continue;
    }

    try {
      const result = await computePrediction(matchData);
      if (result.error) {
        console.error(`  [ERR] ${matchId}: ${result.error}`);
        errors++;
      } else {
        computed++;
        const mk = result.markets;
        console.log(`  [OK] ${matchData.homeTeam} vs ${matchData.awayTeam}: H${mk?.homeProb}% D${mk?.drawProb}% A${mk?.awayProb}% (Elo: ${elo.home}-${elo.away})`);
      }
    } catch (e) {
      console.error(`  [ERR] ${matchId}: ${e.message}`);
      errors++;
    }

    await pause(500);
  }

  if (db) db.close();
  console.log(`\n[cron-compute-predictions] Done: ${computed} computed, ${errors} errors`);
}

main().catch(e => {
  console.error('[cron-compute-predictions] FATAL:', e.message);
  process.exit(1);
});
