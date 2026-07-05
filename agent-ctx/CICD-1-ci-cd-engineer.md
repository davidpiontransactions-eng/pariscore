---
Task ID: CICD-1
Agent: ci-cd-engineer
Task: Add CI/CD pipeline with GitHub Actions (lint, E2E, load test, build workflows) to the Next.js 16 app

# Previous agents' work records available in this /agent-ctx directory:
#   K6-1-load-test-engineer.md       — k6 load tests (tests/load/script.js, 4 scenarios)
#   E2E-1-e2e-test-engineer.md       — Playwright E2E suite (51 specs in tests/)
#   SENTRY-1-full-stack-developer.md — Sentry error monitoring
#   SEO-1-full-stack-developer.md    — SEO (sitemap, JSON-LD, robots, manifest)
#   WS-1-full-stack-developer.md     — WebSocket live updates mini-service (port 3001)
# This task (CICD-1) builds CI workflows ON TOP of those existing test/build assets.

Work Log:
- Inspected project: package.json scripts (`lint`, `build`=next build + copy static/public into `.next/standalone`, `start`=node .next/standalone/server.js), next.config.ts (`output: "standalone"`), playwright.config.ts (testDir ./tests, 51 specs, baseURL localhost:3000, workers:1, reporters html+list, webServer omitted so it reuses an existing server), tests/load/script.js (4 k6 scenarios selected via K6_SCENARIO env var, thresholds tuned for prod). Local k6 = v2.1.0 at ~/.local/bin/k6.
- `.github/` did not exist → created `.github/workflows/`.
- Created 4 workflow files (details below). All use:
  - `oven-sh/setup-bun@v2` (never setup-node)
  - `bun install --frozen-lockfile` (reproducible)
  - `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`
  - `actions/checkout@v4`, `actions/upload-artifact@v4`, `actions/cache@v4`

Files created:
1. `.github/workflows/lint.yml`
   - Triggers: push to main, PR to main.
   - Job `lint` (ubuntu-latest, 10m timeout): checkout → setup-bun@v2 → `bun install --frozen-lockfile` → `bun run lint`. Fails on any ESLint error.

2. `.github/workflows/e2e.yml`
   - Triggers: push to main, PR to main.
   - Job `e2e` (ubuntu-latest, 25m timeout). Job-level env: NODE_ENV=production, NEXT_PUBLIC_POSTHOG_KEY="" (empty → analytics off), ODDS_API_KEY unset → mock data, PORT=3000, HOSTNAME=127.0.0.1.
   - Steps: checkout → setup-bun@v2 → frozen install → `bunx playwright install --with-deps chromium` → `bun run build` (standalone) → start `node .next/standalone/server.js &` (PID saved to server.pid) → poll http://localhost:3000 up to 60×1s for HTTP 200 → `bunx playwright test --reporter=list --reporter=html` (CI=true so playwright.config applies 1 retry) → on failure upload `playwright-report/` + `server.log` as artifacts → `if: always()` kill server by PID (SIGTERM then SIGKILL).
   - NOTE: used `--reporter=list --reporter=html` rather than a bare `--reporter=list` so the HTML report is still generated for the artifact upload (a single `--reporter` flag overrides the config reporters array).

3. `.github/workflows/load-test.yml`
   - Triggers: PR to main ONLY (load tests are slow; skipped on plain pushes).
   - Job `load-test` (ubuntu-latest, 30m timeout). Same degraded-mode env as e2e + BASE_URL=http://localhost:3000.
   - Steps: checkout → setup-bun@v2 → install → install k6 (resolve latest tag via GitHub API, download `https://github.com/grafana/k6/releases/download/<tag>/k6-<tag>-linux-amd64.tar.gz`, `install` to /usr/local/bin/k6, `k6 version`) → build + start prod server + wait-for-ready (same pattern as e2e) → `K6_SCENARIO=smoke k6 run tests/load/script.js | tee k6-logs/smoke.log` → `K6_SCENARIO=api_load k6 run tests/load/script.js | tee k6-logs/api_load.log` (skips elo_stress + mixed to keep CI fast). Each k6 run ends with `|| echo "… threshold failures are informational in CI"` so NON-ZERO k6 exits DO NOT fail the build. Upload `k6-logs/` + `server.log` (`if: always()`). Kill server always.
   - k6 version is dynamic (latest). Comment documents how to pin (replace API call with `K6_VERSION="v0.56.0"`).

4. `.github/workflows/build.yml`
   - Triggers: push to main, PR to main.
   - Job `build` (ubuntu-latest, 20m timeout). Env: NEXT_PUBLIC_POSTHOG_KEY="" (degraded build).
   - Steps: checkout → setup-bun@v2 → frozen install → cache `.next/cache` (key = `${{ runner.os }}-nextjs-` + bun.lock hash + src/** hash, restore-keys OS-level fallback) → `bun run build` → verify `.next/standalone/server.js` exists (fail with ::error:: if missing) → on failure upload `.next/` (excluding `.next/cache`) as `standalone-build-failed` artifact for debugging.

Verification:
- YAML syntax: validated all 4 files with `bunx js-yaml` → all VALID.
- Lint: ran `bun run lint` locally → exit code 0, 0 errors.
- Did NOT run `bun run build` locally (per task: document, don't fix; CI runner has more resources and dev server is already on port 3000).
- Did NOT run the workflows (no GitHub Actions available in sandbox).
- Did NOT start the dev server. Did NOT modify any application code.

Summary:
- 4 production-ready GitHub Actions workflows created, all concurrency-controlled, all using setup-bun@v2 + frozen lockfile.
- lint/build/e2e run on push & PR to main; load-test runs on PR to main only.
- E2E + load-test build the standalone prod bundle and run `node .next/standalone/server.js` (not the dev server) in degraded mode.
- Load-test runs only smoke + api_load; k6 threshold failures are non-fatal; logs uploaded.
- Lint passes locally (0 errors); all YAML validated.

Deliverables (how to trigger):
- Push to `main` → Lint, Build, E2E workflows run automatically.
- Open a PR against `main` → Lint, Build, E2E, AND Load-Test workflows run.
- Manual dispatch not configured (triggers only on push/PR per spec). To add `workflow_dispatch`, append it to the `on:` block of any workflow.
- Workflows can be viewed/ rerun from the repo's Actions tab on GitHub.
