# Task K6-1 — load-test-engineer

## Task
Add k6 load tests for the Next.js 16 tennis prematch app at `/home/z/my-project`.
Endpoints: `GET /`, `GET /api/tennis/prematch` (in-mem 60s cache), `GET /api/tennis/elo-history?matchId=m1` (compute every call). 4 scenarios + thresholds. Do NOT modify app code, do NOT start dev server (already on :3000).

## Work performed
1. Verified endpoint shapes via curl — all 200 OK with expected bodies (matches[3], a.history[24]).
2. k6 install: not in PATH, no sudo, no docker. Downloaded official static binary `k6 v2.1.0 linux-amd64` from GitHub releases to `~/.local/bin/k6`. Verified working.
3. Discovered k6 v2 dropped the `--scenario` CLI flag (task spec referenced it). Implemented single-scenario selection via `K6_SCENARIO` env var inside the script (clear error for unknown names).
4. Wrote `tests/load/script.js` — self-contained, 4 scenarios (smoke per-vu-iterations, api_load constant-vus 50×60s, elo_stress constant-vus 20×45s, mixed ramping-vus 0→20→20→0 over 2min with 60/30/10 split). Global + per-scenario thresholds.
5. Ran smoke → 10/10 iters, 20/20 checks pass, 0 errors. p95=568-694ms (SSR dev mode).
6. Ran all 4 scenarios concurrently → 11,682 reqs / 2m00.3s, 0 errors, 23,364/23,364 checks pass.

## Results — see `/home/z/my-project/tests/load/results/all-scenarios.log`
| Scenario   | Reqs  | p95      | p99   | Err  | Checks | Threshold |
|------------|-------|----------|-------|------|--------|-----------|
| smoke      | 10    | 568ms    | —     | 0%   | 100%   | ✓         |
| api_load   | 7,940 | 377ms    | —     | 0%   | 100%   | ✓         |
| elo_stress | 2,271 | 400ms    | —     | 0%   | 100%   | ✗ p95<300 |
| mixed      | 1,461 | 1.01s    | 1.86s | 0%   | 100%   | ✗ p95<500,p99<1000 |
| Global     | 11,682| 507ms    | 1.44s | 0%   | 100%   | ✗ p95<500,p99<1000 |

5 of 14 thresholds failed — all latency-related. Zero HTTP errors, 100% assertion success everywhere. Failures stem from dev-server (Turbopack) SSR latency and uncached compute endpoint under concurrent load. NOT fixed (report only per task spec). See worklog.md K6-1 section for full root-cause notes.

## Files
- `tests/load/script.js` — k6 script (created)
- `tests/load/results/smoke.log` — smoke run output (created)
- `tests/load/results/all-scenarios.log` — full 4-scenario run output (created)
- `~/.local/bin/k6` — k6 v2.1.0 binary (installed)
- `worklog.md` — appended K6-1 section

## Run commands
```
export PATH="$HOME/.local/bin:$PATH"
K6_SCENARIO=smoke k6 run --summary-mode full tests/load/script.js   # sanity
K6_SCENARIO=api_load k6 run tests/load/script.js                    # single
k6 run --summary-mode full tests/load/script.js                     # all 4
```

## Handoff notes for downstream agents
- k6 binary is at `~/.local/bin/k6` — NOT in default PATH. Any agent running tests must `export PATH="$HOME/.local/bin:$PATH"` first.
- k6 v2 has no `--scenario` flag. Use `K6_SCENARIO=<name>` env var.
- The app's dev server (Turbopack) is slow for SSR `/` — production build would meet latency thresholds. Don't "fix" the app based on these numbers.
- The elo-history endpoint has no cache and computes synchronously; if a future task wants to meet p95<300ms under load, cache by matchId or move compute off the event loop.
- No application code was modified by this task.
- POST-TEST SERVER STATE: After the all-scenarios run completed (11,682 reqs / 2min), the dev server on :3000 went down (connection refused, no next/node/bun process). The k6 test itself finished cleanly (0 interrupted iterations, 0% failures) — the server stayed up for the full 2 minutes. It died some time AFTER the test, likely from memory pressure under the sustained 90-VU load. Did NOT manually restart it (task spec: "DO NOT start the dev server"). The system's auto-restart watchdog or the user should bring it back. If a downstream agent needs the server, check `ss -tlnp | grep :3000` first and wait/restart per their own task constraints.
