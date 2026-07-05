/**
 * k6 load tests for the Next.js 16 tennis prematch app.
 *
 * Task ID: K6-1
 *
 * Endpoints under test (app runs on port 3000, auto-started):
 *   GET /                                 — SSR page (Tennis matches dashboard)
 *   GET /api/tennis/prematch              — in-memory cached (60s) prematch API
 *   GET /api/tennis/elo-history?matchId=m1 — Elo history (recomputed every call)
 *
 * Scenarios:
 *   A. smoke        — 10 VUs, 1 iteration each (sanity check, max 30s)
 *   B. api_load     — 50 VUs constant for 60s on /api/tennis/prematch
 *   C. elo_stress   — 20 VUs constant for 45s on /api/tennis/elo-history?matchId=m1
 *   D. mixed        — ramp 0→20→20→0 over 2min, mix 60/30/10 across the three endpoints
 *
 * Run a single scenario (k6 v2 dropped the --scenario flag; use the env var):
 *   K6_SCENARIO=smoke      k6 run tests/load/script.js
 *   K6_SCENARIO=api_load   k6 run tests/load/script.js
 *   K6_SCENARIO=elo_stress k6 run tests/load/script.js
 *   K6_SCENARIO=mixed      k6 run tests/load/script.js
 *
 * Run all scenarios concurrently:
 *   k6 run tests/load/script.js
 *
 * Override base URL (default http://localhost:3000):
 *   k6 run -e BASE_URL=http://host:port tests/load/script.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ELO_URL = `${BASE}/api/tennis/elo-history?matchId=m1`;
const PREMATCH_URL = `${BASE}/api/tennis/prematch`;
const HOME_URL = `${BASE}/`;

// Common request params — no external dependencies, just sensible defaults.
const PARAMS = {
  headers: {
    'Accept': 'application/json, text/html',
    'User-Agent': 'k6-load-test/K6-1',
  },
  timeout: '15s',
};

// ---------------------------------------------------------------------------
// Scenario A — Smoke: each VU hits GET / once, assert 200 + body has "Tennis".
// ---------------------------------------------------------------------------
export function smokePage() {
  const res = http.get(HOME_URL, PARAMS);
  check(res, {
    'smoke: status is 200': (r) => r.status === 200,
    'smoke: body contains Tennis': (r) => typeof r.body === 'string' && r.body.includes('Tennis'),
  });
}

// ---------------------------------------------------------------------------
// Scenario B — API load: 50 VUs hammering the cached prematch endpoint.
// ---------------------------------------------------------------------------
export function apiLoad() {
  const res = http.get(PREMATCH_URL, PARAMS);
  check(res, {
    'api_load: status is 200': (r) => r.status === 200,
    'api_load: has matches array of 3': (r) => {
      const matches = r.json('matches');
      return Array.isArray(matches) && matches.length === 3;
    },
  });
  // Brief pacing so each VU does ~5 req/s max (cache stays warm).
  sleep(0.2);
}

// ---------------------------------------------------------------------------
// Scenario C — Elo stress: 20 VUs hitting compute-heavy elo-history endpoint.
// ---------------------------------------------------------------------------
export function eloStress() {
  const res = http.get(ELO_URL, PARAMS);
  check(res, {
    'elo_stress: status is 200': (r) => r.status === 200,
    'elo_stress: has a.history array': (r) => {
      const h = r.json('a.history');
      return Array.isArray(h) && h.length > 0;
    },
  });
  sleep(0.2);
}

// ---------------------------------------------------------------------------
// Scenario D — Mixed realistic: ramping VUs, weighted endpoint distribution.
//   60% GET /  |  30% GET /api/tennis/prematch  |  10% GET /api/tennis/elo-history?matchId=m1
// ---------------------------------------------------------------------------
export function mixedRequest() {
  const roll = Math.random();
  if (roll < 0.6) {
    const res = http.get(HOME_URL, PARAMS);
    check(res, {
      'mixed/: status is 200': (r) => r.status === 200,
      'mixed/: body contains Tennis': (r) => typeof r.body === 'string' && r.body.includes('Tennis'),
    });
  } else if (roll < 0.9) {
    const res = http.get(PREMATCH_URL, PARAMS);
    check(res, {
      'mixed/prematch: status is 200': (r) => r.status === 200,
      'mixed/prematch: 3 matches': (r) => {
        const m = r.json('matches');
        return Array.isArray(m) && m.length === 3;
      },
    });
  } else {
    const res = http.get(ELO_URL, PARAMS);
    check(res, {
      'mixed/elo: status is 200': (r) => r.status === 200,
      'mixed/elo: has a.history': (r) => {
        const h = r.json('a.history');
        return Array.isArray(h) && h.length > 0;
      },
    });
  }
  sleep(1); // 1 iteration / VU / second → realistic pacing
}

// ---------------------------------------------------------------------------
// Options — scenarios + thresholds
//
// k6 v2 removed the `--scenario` CLI flag, so single-scenario runs are done
// via the K6_SCENARIO env var (e.g. `K6_SCENARIO=smoke k6 run ...`). When
// unset, all four scenarios run concurrently.
// ---------------------------------------------------------------------------
const ALL_SCENARIOS = {
  // A. Smoke — sanity check, run before larger runs.
  smoke: {
    executor: 'per-vu-iterations',
    vus: 10,
    iterations: 1,
    maxDuration: '30s',
    exec: 'smokePage',
    gracefulStop: '5s',
  },
  // B. API load — constant 50 VUs for 60s on the cached prematch endpoint.
  api_load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '60s',
    exec: 'apiLoad',
    gracefulStop: '5s',
  },
  // C. Elo stress — constant 20 VUs for 45s on compute-heavy elo endpoint.
  elo_stress: {
    executor: 'constant-vus',
    vus: 20,
    duration: '45s',
    exec: 'eloStress',
    gracefulStop: '5s',
  },
  // D. Mixed realistic — ramp 0→20 (30s), hold 20 (60s), ramp 20→0 (30s).
  mixed: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '60s', target: 20 },
      { duration: '30s', target: 0 },
    ],
    exec: 'mixedRequest',
    gracefulRampDown: '10s',
  },
};

const selectedScenario = __ENV.K6_SCENARIO;
let scenarios = ALL_SCENARIOS;
if (selectedScenario) {
  if (!ALL_SCENARIOS[selectedScenario]) {
    throw new Error(
      `Unknown K6_SCENARIO="${selectedScenario}". Valid: ${Object.keys(ALL_SCENARIOS).join(', ')}`
    );
  }
  scenarios = { [selectedScenario]: ALL_SCENARIOS[selectedScenario] };
}

export const options = {
  scenarios,
  thresholds: {
    // Global (per spec) — aggregated across all scenarios.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],

    // Per-scenario targets (honors the targets in the task spec).
    // k6 automatically tags every metric with the scenario name.
    'http_req_duration{scenario:smoke}':      ['p(95)<1000'],
    'http_req_duration{scenario:api_load}':   ['p(95)<500'],   // <200ms warm cache, <500ms cold
    'http_req_duration{scenario:elo_stress}': ['p(95)<300'],   // compute on every call
    'http_req_duration{scenario:mixed}':      ['p(95)<500', 'p(99)<1000'],

    'http_req_failed{scenario:smoke}':      ['rate<0.01'],
    'http_req_failed{scenario:api_load}':   ['rate<0.01'],
    'http_req_failed{scenario:elo_stress}': ['rate<0.01'],
    'http_req_failed{scenario:mixed}':      ['rate<0.01'],

    // Check success rate (assertions inside each scenario).
    checks: ['rate>0.99'],
  },
};
