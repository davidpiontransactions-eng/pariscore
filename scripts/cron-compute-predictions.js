#!/usr/bin/env node
/**
 * cron-compute-predictions.js — Calcule automatiquement les prédictions
 * pour les matchs à venir (upcoming) via l'API BSD.
 *
 * Usage:
 *   node scripts/cron-compute-predictions.js
 *   node scripts/cron-compute-predictions.js --dry
 *   node scripts/cron-compute-predictions.js --days=3
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
const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS_AHEAD = daysArg ? parseInt(daysArg.split('=')[1], 10) : 2;

const pause = ms => new Promise(r => setTimeout(r, ms));

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
    const req = https.request(url, {
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
  console.log(`[cron-compute-predictions] start — looking ${DAYS_AHEAD} days ahead`);

  const today = new Date();
  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + DAYS_AHEAD);
  const dateStr = dateTo.toISOString().split('T')[0];

  // Fetch upcoming events from BSD
  const events = [];
  const leagues = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38,39,40,41,42,43,44,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69];

  for (const leagueId of leagues.slice(0, 10)) { // Top 10 ligues pour commencer
    try {
      const params = new URLSearchParams({
        league_id: String(leagueId),
        date_from: today.toISOString().split('T')[0],
        date_to: dateStr,
        status: 'upcoming',
        page_size: '50'
      });
      const res = await bsdFetch(`/events/?${params.toString()}`);
      const results = res?.data?.results ?? res?.results ?? [];
      for (const event of results) {
        if (event.home_score == null && event.away_score == null) {
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
    const matchData = {
      matchId: `bsd-${event.id}`,
      homeTeam: event.home_team || 'Home',
      awayTeam: event.away_team || 'Away',
      homeElo: event.home_elo ?? undefined,
      awayElo: event.away_elo ?? undefined,
      homeXg: event.home_xg ?? event.odds_home ? (1 / event.odds_home * 2.5) : undefined,
      awayXg: event.away_xg ?? event.odds_away ? (1 / event.odds_away * 2.5) : undefined,
    };

    if (isDry) {
      console.log(`  [DRY] ${matchData.homeTeam} vs ${matchData.awayTeam} (${matchData.matchId})`);
      continue;
    }

    try {
      const result = await computePrediction(matchData);
      if (result.error) {
        console.error(`  [ERR] ${matchData.matchId}: ${result.error}`);
        errors++;
      } else {
        computed++;
        console.log(`  [OK] ${matchData.homeTeam} vs ${matchData.awayTeam}: H${result.markets?.homeProb}% D${result.markets?.drawProb}% A${result.markets?.awayProb}%`);
      }
    } catch (e) {
      console.error(`  [ERR] ${matchData.matchId}: ${e.message}`);
      errors++;
    }

    await pause(500); // Rate limit
  }

  console.log(`\n[cron-compute-predictions] Done: ${computed} computed, ${errors} errors`);
}

main().catch(e => {
  console.error('[cron-compute-predictions] FATAL:', e.message);
  process.exit(1);
});
