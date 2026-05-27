// test_w6_tennis_upcoming.js — E2E integration tests for GET /api/v1/tennis/upcoming
//
// Boots server.js as a child process on an ephemeral port, runs the probe matrix
// over the W6 contract (.context/sps_pipeline_contract.md), asserts response codes,
// schema integrity, and W1-W5 fixes. Stdlib only (http, child_process, assert).
//
// Run: node test_w6_tennis_upcoming.js
// Exit code: 0 = all pass, 1 = any assertion failed.

'use strict';

const assert = require('node:assert');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname);
const SERVER_PATH = path.join(ROOT, 'server.js');
const BOOT_TIMEOUT_MS = 60_000;
const REQ_TIMEOUT_MS = 20_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function request(port, method, urlPath, extraHeaders) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: urlPath,
        headers: Object.assign({ 'User-Agent': 'w6-e2e/1.0' }, extraHeaders || {}),
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          let json = null;
          try { json = JSON.parse(body); } catch (_) { /* keep null */ }
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      }
    );
    req.setTimeout(REQ_TIMEOUT_MS, () => {
      req.destroy(new Error('request timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForReady(port) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const r = await request(port, 'GET', '/api/v1/tennis/upcoming');
      if (r.status === 200 && r.json) return;
    } catch (_) { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not boot within ${BOOT_TIMEOUT_MS}ms`);
}

function ok(label) {
  console.log(`  OK  ${label}`);
}

// ─── Test cases ───────────────────────────────────────────────────────────────

async function runTests(port) {
  let passed = 0;
  let failed = 0;
  const fail = (label, err) => {
    failed += 1;
    console.error(`  FAIL ${label}: ${err && err.message ? err.message : err}`);
  };

  // 1. GET default returns 200 with schema
  try {
    const r = await request(port, 'GET', '/api/v1/tennis/upcoming');
    assert.strictEqual(r.status, 200, 'status 200');
    assert.ok(r.json, 'response is JSON');
    assert.ok(Array.isArray(r.json.matches), 'matches is array');
    assert.ok(r.json.meta, 'meta present');
    assert.strictEqual(r.json.meta.lookahead_min_h, 24, 'default min=24');
    assert.strictEqual(r.json.meta.lookahead_max_h, 36, 'default max=36');
    assert.strictEqual(r.json.meta.total, r.json.matches.length, 'total === len(matches)');
    assert.ok(Array.isArray(r.json.meta.warnings), 'warnings is array');
    ok('default GET returns schema-valid 200');
    passed += 1;
  } catch (e) { fail('default GET', e); }

  // 2. W1 — non-GET → 405 + Allow header
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    try {
      const r = await request(port, method, '/api/v1/tennis/upcoming');
      assert.strictEqual(r.status, 405, `${method} status 405`);
      assert.strictEqual(r.headers.allow, 'GET', `${method} Allow header`);
      assert.ok(r.json, `${method} JSON body`);
      assert.strictEqual(r.json.error, 'method_not_allowed', `${method} error code`);
      ok(`W1: ${method} → 405 + Allow: GET`);
      passed += 1;
    } catch (e) { fail(`W1 ${method}`, e); }
  }

  // 3. W2 — tour whitelist
  try {
    const valid = await request(port, 'GET', '/api/v1/tennis/upcoming?tour=atp');
    assert.strictEqual(valid.json.meta.tour_filter, 'ATP', 'atp → ATP');
    assert.deepStrictEqual(valid.json.meta.warnings, [], 'no warning for ATP');
    const wta = await request(port, 'GET', '/api/v1/tennis/upcoming?tour=WTA');
    assert.strictEqual(wta.json.meta.tour_filter, 'WTA', 'WTA preserved');
    const itf = await request(port, 'GET', '/api/v1/tennis/upcoming?tour=ITF');
    assert.strictEqual(itf.json.meta.tour_filter, null, 'ITF → null filter');
    assert.ok(itf.json.meta.warnings.includes('tour_filter_ignored'),
              'ITF emits tour_filter_ignored warning');
    ok('W2: tour whitelist ATP/WTA, others → null + warning');
    passed += 1;
  } catch (e) { fail('W2 tour whitelist', e); }

  // 4. W3 — cap on lookahead_max_h
  try {
    const r = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_max_h=999999');
    assert.strictEqual(r.json.meta.lookahead_max_h, 7 * 24, 'capped to 168h');
    assert.ok(r.json.meta.warnings.includes('lookahead_max_h_capped'),
              'cap warning emitted');
    ok('W3: lookahead_max_h capped to 7 days + warning');
    passed += 1;
  } catch (e) { fail('W3 cap', e); }

  // 5. W4 — dynamic dates_scanned grows with window
  try {
    const small = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_max_h=36');
    const medium = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_max_h=72');
    const large = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_max_h=120');
    assert.strictEqual(small.json.meta.dates_scanned.length, 3, 'max=36 → 3 dates');
    assert.strictEqual(medium.json.meta.dates_scanned.length, 4, 'max=72 → 4 dates');
    assert.strictEqual(large.json.meta.dates_scanned.length, 6, 'max=120 → 6 dates');
    ok('W4: dates_scanned grows with lookahead_max_h (3 / 4 / 6)');
    passed += 1;
  } catch (e) { fail('W4 dynamic scan', e); }

  // 6. Edge cases — clamping
  try {
    const neg = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_min_h=-5');
    assert.strictEqual(neg.json.meta.lookahead_min_h, 0, 'negative → 0');
    const nan = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_min_h=abc&lookahead_max_h=xyz');
    assert.strictEqual(nan.json.meta.lookahead_min_h, 24, 'NaN min → default 24');
    assert.strictEqual(nan.json.meta.lookahead_max_h, 36, 'NaN max → default 36');
    const inv = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_min_h=72&lookahead_max_h=0');
    assert.strictEqual(inv.json.meta.lookahead_max_h, 72, 'max < min → clamped to min');
    ok('edge cases: negative, NaN, inverted (all sanitized)');
    passed += 1;
  } catch (e) { fail('edge cases', e); }

  // 7. R1 — /api/v1/sources/health includes sps_pipeline section
  try {
    const h = await request(port, 'GET', '/api/v1/sources/health');
    assert.strictEqual(h.status, 200, 'health 200');
    assert.ok(h.json.sps_pipeline, 'sps_pipeline present');
    assert.ok(['ok', 'degraded', 'stale', 'unknown'].includes(h.json.sps_pipeline.status),
              'sps_pipeline.status in expected set');
    assert.ok(h.json.sps_pipeline.endpoint_telemetry, 'endpoint_telemetry present');
    const tel = h.json.sps_pipeline.endpoint_telemetry;
    assert.ok(typeof tel.calls_total === 'number', 'calls_total numeric');
    assert.ok(tel.calls_total >= 1, 'telemetry recorded prior calls');
    ok(`R1: /api/v1/sources/health exposes sps_pipeline (calls_total=${tel.calls_total})`);
    passed += 1;
  } catch (e) { fail('R1 health', e); }

  // 8. W5 — token gate inactive when env unset (default in this test)
  try {
    const r = await request(port, 'GET', '/api/v1/tennis/upcoming');
    assert.strictEqual(r.status, 200, 'unauthenticated access OK (no env token set)');
    ok('W5: token gate dormant without SPS_INTERNAL_TOKEN env');
    passed += 1;
  } catch (e) { fail('W5 no-token', e); }

  // 9. Schema invariants
  try {
    const r = await request(port, 'GET', '/api/v1/tennis/upcoming?lookahead_max_h=72');
    const meta = r.json.meta;
    const required = ['now_utc', 'lookahead_min_h', 'lookahead_max_h', 'tour_filter',
                      'dates_scanned', 'total', 'latency_ms', 'warnings'];
    for (const k of required) {
      assert.ok(k in meta, `meta.${k} present`);
    }
    assert.ok(typeof meta.latency_ms === 'number', 'latency_ms numeric');
    assert.ok(meta.latency_ms >= 0, 'latency_ms non-negative');
    ok('schema invariants (meta keys + latency_ms)');
    passed += 1;
  } catch (e) { fail('schema invariants', e); }

  return { passed, failed };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

(async () => {
  const port = await findFreePort();
  console.log(`Booting server on port ${port}...`);
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: Object.assign({}, process.env, { PORT: String(port) }),
    stdio: ['ignore', 'ignore', 'ignore'],
    cwd: ROOT,
  });

  let exitCode = 1;
  try {
    await waitForReady(port);
    console.log('Server ready. Running tests...\n');
    const { passed, failed } = await runTests(port);
    console.log(`\nResult: ${passed} passed, ${failed} failed.`);
    exitCode = failed === 0 ? 0 : 1;
  } catch (err) {
    console.error('Test runner error:', err && err.message);
    exitCode = 1;
  } finally {
    child.kill();
    // Give it a moment to actually exit on Windows.
    await new Promise((r) => setTimeout(r, 500));
    process.exit(exitCode);
  }
})();
