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

// Top ligues pour les prédictions
const BSD_LEAGUE_IDS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20];

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
  console.log(`[cron-compute-predictions] start at ${new Date().toISOString()}`);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const events = [];

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
        // Only upcoming (no score yet)
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
    const matchId = `bsd-${event.id}`;

    // Estimate xG from odds (simple approximation)
    const oddsH = event.odds_home ? Number(event.odds_home) : null;
    const oddsA = event.odds_away ? Number(event.odds_away) : null;
    const xgH = oddsH ? Math.round((1 / oddsH * 2.5) * 100) / 100 : undefined;
    const xgA = oddsA ? Math.round((1 / oddsA * 2.5) * 100) / 100 : undefined;

    const matchData = {
      matchId,
      homeTeam: event.home_team || 'Home',
      awayTeam: event.away_team || 'Away',
      homeXg: xgH,
      awayXg: xgA,
    };

    if (isDry) {
      console.log(`  [DRY] ${matchData.homeTeam} vs ${matchData.awayTeam} (xG: ${xgH ?? 'N/A'}-${xgA ?? 'N/A'})`);
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
        console.log(`  [OK] ${matchData.homeTeam} vs ${matchData.awayTeam}: H${mk?.homeProb}% D${mk?.drawProb}% A${mk?.awayProb}%`);
      }
    } catch (e) {
      console.error(`  [ERR] ${matchId}: ${e.message}`);
      errors++;
    }

    await pause(500);
  }

  console.log(`\n[cron-compute-predictions] Done: ${computed} computed, ${errors} errors`);
}

main().catch(e => {
  console.error('[cron-compute-predictions] FATAL:', e.message);
  process.exit(1);
});
