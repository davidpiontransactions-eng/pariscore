#!/usr/bin/env node
/**
 * test-settle-existing.js — Test settle with an existing match from match_stats_history.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const LEGACY_DB = path.join(ROOT, 'pariscore.db');
const PRISMA_DB = path.join(ROOT, 'dev.db');
const PREDICTIONS_BASE = 'http://localhost:3005';

// Pick a random finished match not yet predicted
const legacyDb = new Database(LEGACY_DB, { readonly: true });
const prismaDb = new Database(PRISMA_DB, { readonly: true });
const predictedIds = new Set(prismaDb.prepare('SELECT matchId FROM "PredictionLog"').all().map(r => r.matchId));
const match = legacyDb.prepare(`
  SELECT bsd_event_id, home_team, away_team, home_score, away_score
  FROM match_stats_history
  WHERE home_score IS NOT NULL
  ORDER BY RANDOM() LIMIT 1
`).all().find(m => !predictedIds.has(m.bsd_event_id));
legacyDb.close();
prismaDb.close();

if (!match) { console.log('No unsettled matches found'); process.exit(0); }

console.log(`Match: ${match.home_team} vs ${match.away_team} (${match.home_score}-${match.away_score}) [${match.bsd_event_id}]`);

// Compute prediction
const payload = JSON.stringify({
  matchId: match.bsd_event_id,
  homeTeam: match.home_team,
  awayTeam: match.away_team,
});

const url = new URL('/api/v1/predictions/compute', PREDICTIONS_BASE);
const req = http.request(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.error) { console.error('Compute error:', result.error); process.exit(1); }
    console.log(`Predicted: H${result.markets.homeProb}% D${result.markets.drawProb}% A${result.markets.awayProb}%`);

    // Settle
    const settlePayload = JSON.stringify({
      matchId: match.bsd_event_id,
      homeScore: match.home_score,
      awayScore: match.away_score,
    });
    const settleUrl = new URL('/api/v1/predictions/settle', PREDICTIONS_BASE);
    const req2 = http.request(settleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(settlePayload) }
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('Settle:', data2);
      });
    });
    req2.write(settlePayload);
    req2.end();
  });
});
req.write(payload);
req.end();
