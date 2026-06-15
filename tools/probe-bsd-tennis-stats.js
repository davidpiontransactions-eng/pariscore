#!/usr/bin/env node
/**
 * bd dl49 Phase 4.1.1 — Probe BSD tennis stats endpoint coverage.
 *
 * Lit premiers N matchs tennis finished du cache local (api_cache key
 * bsd_tennis_matches_*), fetch BSD /api/v2/events/{id}/stats/ pour chacun,
 * agrège fields disponibles. Output rapport text avec :
 *   - Liste fields top-level vus
 *   - Pour chaque col Sackmann requise (w_svpt, w_1stIn etc) : présence/absence
 *   - Sample raw response (premier match seulement)
 *
 * Permet décision Phase 4.1.1 : si BSD stats endpoint expose svpt/1stIn/bpSaved
 * pour tennis → étendre ETL avec fetch supplémentaire. Sinon Phase 4.2 wire
 * consumers avec cols partielles (BSD ace/df seulement).
 *
 * USAGE:
 *   BSD_API_KEY=xxx node tools/probe-bsd-tennis-stats.js [--limit=N] [--save-raw]
 *
 * EXIT CODES:
 *   0 OK    1 fatal    2 partial (some matches failed)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const BSD_API_KEY = process.env.BSD_API_KEY || process.env.BSD_LIVE_TOKEN;
const BSD_BASE = 'https://sports.bzzoiro.com';

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) || 5 : 5;
const SAVE_RAW = process.argv.includes('--save-raw');

if (!BSD_API_KEY) {
  console.error('[probe] BSD_API_KEY manquant .env');
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error(`[probe] DB introuvable: ${DB_PATH}`);
  process.exit(1);
}

function bsdFetch(endpoint, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(BSD_BASE + endpoint);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': `Bearer ${BSD_API_KEY}`, 'Accept': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

function walkKeys(obj, prefix = '', out = new Set()) {
  if (obj == null) return out;
  if (typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    if (obj.length > 0) walkKeys(obj[0], prefix + '[]', out);
    return out;
  }
  for (const k of Object.keys(obj)) {
    out.add(prefix ? `${prefix}.${k}` : k);
    if (typeof obj[k] === 'object') walkKeys(obj[k], prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const SACKMANN_SERVE_COLS = [
  'svpt', '1stIn', '1stWon', '2ndWon', 'SvGms', 'bpSaved', 'bpFaced',
  'ace', 'df',
];

(async () => {
  const db = new Database(DB_PATH, { readonly: true });
  const cacheRows = db.prepare(`
    SELECT key, data FROM api_cache
    WHERE key LIKE '%calib_raw%' OR source = 'bsd_tennis'
    ORDER BY created_at DESC LIMIT 5
  `).all();
  db.close();

  if (cacheRows.length === 0) {
    console.error('[probe] aucun cache BSD tennis matches trouvé');
    process.exit(1);
  }

  // Extract sample match IDs (premier finished)
  const candidates = [];
  for (const r of cacheRows) {
    let data;
    try { data = JSON.parse(r.data); } catch { continue; }
    const matches = Array.isArray(data) ? data : (data && data.results) || [];
    for (const m of matches) {
      const status = String(m.match?.status || m.status || '').toLowerCase();
      if ((m.match?.id || m.id) && /finished|complete|ended/.test(status)) {
        candidates.push({ id: (m.match?.id || m.id), name: `${(m.match?.player1?.name || m.player1?.name || '?')} vs ${(m.match?.player2?.name || m.player2?.name || '?')}` });
        if (candidates.length >= LIMIT * 3) break;
      }
    }
    if (candidates.length >= LIMIT * 3) break;
  }

  if (candidates.length === 0) {
    console.error('[probe] aucun match finished trouvé dans cache');
    process.exit(1);
  }

  console.log(`[probe] ${candidates.length} candidats trouvés, fetch stats endpoint pour ${LIMIT} premiers...\n`);

  const probeEndpoints = [
    { key: 'stats', path: (id) => `/api/v2/events/${id}/stats/` },
    { key: 'incidents', path: (id) => `/api/v2/events/${id}/incidents/` },
    { key: 'lineups', path: (id) => `/api/v2/events/${id}/lineups/` },
  ];

  const aggResults = {};  // {endpoint: { fields: Set, freq: Map, success, fail, sample }}
  for (const ep of probeEndpoints) {
    aggResults[ep.key] = { fields: new Set(), freq: new Map(), success: 0, fail: 0, sample: null };
  }

  for (let i = 0; i < Math.min(LIMIT, candidates.length); i++) {
    const c = candidates[i];
    console.log(`\n  [${i + 1}/${LIMIT}] ${c.name} (id=${c.id})`);
    for (const ep of probeEndpoints) {
      const agg = aggResults[ep.key];
      process.stdout.write(`    ${ep.key.padEnd(12)} ... `);
      try {
        const res = await bsdFetch(ep.path(c.id));
        if (res.status !== 200 || !res.data) {
          console.log(`HTTP ${res.status}`);
          agg.fail++;
          continue;
        }
        const keys = walkKeys(res.data);
        keys.forEach(k => {
          agg.fields.add(k);
          agg.freq.set(k, (agg.freq.get(k) || 0) + 1);
        });
        agg.success++;
        if (!agg.sample) agg.sample = { id: c.id, name: c.name, data: res.data };
        console.log(`OK · ${keys.size} fields`);
      } catch (e) {
        console.log(`ERR: ${e.message}`);
        agg.fail++;
      }
    }
  }

  // Use stats endpoint pour Sackmann cross-check (compat avec ancien output)
  const allFields = aggResults.stats.fields;
  const fieldFrequency = aggResults.stats.freq;
  const successCount = aggResults.stats.success;
  const failCount = aggResults.stats.fail;
  const sampleResponses = aggResults.stats.sample ? [aggResults.stats.sample] : [];

  // Analyse cols Sackmann requises
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  BSD TENNIS STATS COVERAGE AUDIT — bd dl49 Phase 4.1.1`);
  console.log(`══════════════════════════════════════════════════════════════`);
  for (const ep of probeEndpoints) {
    const agg = aggResults[ep.key];
    console.log(`  ${ep.key.padEnd(12)} : ${agg.success}/${LIMIT} OK · ${agg.fields.size} fields uniques`);
  }
  console.log(``);
  console.log(`  ── Cols Sackmann requises — présence (cross-endpoint) ────`);
  for (const col of SACKMANN_SERVE_COLS) {
    const findings = [];
    for (const ep of probeEndpoints) {
      const matches = [...aggResults[ep.key].fields].filter(f => f.toLowerCase().includes(col.toLowerCase()));
      if (matches.length > 0) findings.push(`${ep.key}: ${matches[0]}${matches.length > 1 ? ` +${matches.length - 1}` : ''}`);
    }
    if (findings.length > 0) {
      console.log(`  ${col.padEnd(10)} : ✓ FOUND — ${findings.join(' · ')}`);
    } else {
      console.log(`  ${col.padEnd(10)} : ✗ ABSENT (aucun endpoint)`);
    }
  }

  console.log(`\n  ── Top 30 fields /stats/ by frequency ────────────────────`);
  const sorted = [...fieldFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  sorted.forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}/${LIMIT}  ${k}`));

  if (SAVE_RAW && sampleResponses.length > 0) {
    const outPath = path.join(ROOT, '.context', `audit-bsd-tennis-stats-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(sampleResponses[0], null, 2));
    console.log(`\n  Sample raw response saved : ${outPath}`);
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  CONCLUSION : ${successCount >= 3 ? '✓ data exploitable' : '⚠ échantillon insuffisant — re-run avec --limit=10+'}`);
  console.log(`══════════════════════════════════════════════════════════════`);

  process.exit(failCount > 0 ? 2 : 0);
})().catch(e => {
  console.error(`[probe] FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
