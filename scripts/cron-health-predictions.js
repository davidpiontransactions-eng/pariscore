#!/usr/bin/env node
/**
 * cron-health-predictions.js — Vérifie la santé du système de prédictions
 * et déclenche des alertes si nécessaire.
 *
 * Usage:
 *   node scripts/cron-health-predictions.js
 *   node scripts/cron-health-predictions.js --dry
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const isDry = process.argv.includes('--dry');
const PREDICTIONS_BASE = process.env.PREDICTIONS_BASE_URL || 'http://localhost:3005';

function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, PREDICTIONS_BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, PREDICTIONS_BASE);
    const payload = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`[health-check] start at ${new Date().toISOString()}`);

  // 1. Health
  const health = await fetchJson('/api/v1/predictions/health');
  console.log(`[health-check] Status: ${health.status}`);
  console.log(`[health-check] Model: ${health.model?.active}`);
  console.log(`[health-check] Brier: ${health.metrics?.brierScore?.toFixed(4)}`);
  console.log(`[health-check] Accuracy: ${(health.metrics?.accuracy * 100)?.toFixed(1)}%`);
  console.log(`[health-check] Sample: ${health.metrics?.sampleSize} predictions`);
  console.log(`[health-check] Total: ${health.data?.totalPredictions} | Settled: ${health.data?.settledPredictions} | Pending: ${health.data?.pendingPredictions}`);

  // 2. Check drift
  if (health.status === 'degraded' && health.metrics?.sampleSize >= 10) {
    console.log('[health-check] Checking drift...');
    try {
      const driftResult = await postJson('/api/v1/predictions/alerts', {});
      if (driftResult.alertSent) {
        console.log('[health-check] Drift alert sent!');
      } else {
        console.log('[health-check] No drift detected');
      }
    } catch (e) {
      console.error('[health-check] Drift check error:', e.message);
    }
  }

  // 3. Summary
  const status = health.status;
  const emoji = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '🚨';
  console.log(`\n${emoji} [health-check] System ${status.toUpperCase()}`);

  if (isDry) {
    console.log('[health-check] Dry run — no actions taken');
  }
}

main().catch(e => {
  console.error('[health-check] FATAL:', e.message);
  process.exit(1);
});
