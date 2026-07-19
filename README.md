# PariScore

> Multi-sport pre-match & live betting intelligence platform — value-bet detection,
> Elo/form-driven predictions, RGPD-compliant analytics, PWA with Web Push alerts.
> Currently spans **8 sports**: tennis, football, MMA, cycling, F1, CS2, NBA, WNBA.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-runtime-fbf0df)](https://bun.sh)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)
[![shadcn/ui](https://img.shields.io/badge/shadcn--ui-New%20York-black)](https://ui.shadcn.com)
[![Playwright](https://img.shields.io/badge/Playwright-51%20tests-2ead33)](https://playwright.dev)
[![License](https://img.shields.io/badge/license-see%20LICENSE--DATA.md-lightgrey)](./LICENSE-DATA.md)

---

## Table of contents

- [What is PariScore](#what-is-pariscore)
- [Quick start](#quick-start)
- [Architecture — two coexisting stacks](#architecture--two-coexisting-stacks)
- [Sports covered](#sports-covered)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Environment variables](#environment-variables)
- [Common commands](#common-commands)
- [Mini-services & cron jobs](#mini-services--cron-jobs)
- [Deployment](#deployment)
- [CI/CD](#cicd)
- [Internationalization](#internationalization)
- [Testing](#testing)
- [PWA & Web Push](#pwa--web-push)
- [Developer tooling](#developer-tooling)
- [Further documentation](#further-documentation)
- [License & data sources](#license--data-sources)

---

## What is PariScore

PariScore is a full-stack betting-assistance platform that combines:

- **Multi-sport predictions** — Elo + Form + H2H models for tennis, plus per-sport
  strategies (BTTS, Over/Under, WM units, surface specialist, etc.).
- **Value-bet detection** — vig-removed implied probabilities vs model probabilities,
  with Web Push alerts when edge crosses the configured threshold.
- **Live updates** — WebSocket point-by-point scoring (tennis) and football live
  dashboards (xG, momentum, Poisson).
- **RGPD-first** — 3-level consent banner (all / analytics-only / reject) gating
  PostHog and Sentry behind explicit user opt-in.
- **PWA** — installable, offline-capable, VAPID Web Push.
- **AI-assisted analysis** — Gemini 2.0 Flash for deep match insights,
  strategy narratives, and refund/edge reasoning.

The codebase is **mid-migration** from a legacy vanilla JS/HTML stack to a modern
Next.js App Router. Both stacks currently run in production — see
[Architecture](#architecture--two-coexisting-stacks) below.

---

## Quick start

```bash
bun install                         # install deps (rebuilds better-sqlite3 + sharp)
cp .env.example .env                # configure (see Environment variables)
bun run dev                         # Next.js dev server on :3000
```

Minimum `.env` to get a non-mocked experience (per `AGENTS.md`):

```
API_FOOTBALL_KEY=...      # football odds + fixtures (api-football.com)
ODDS_API_KEY=...          # multi-sport odds (the-odds-api.com)
GEMINI_API_KEY=...        # AI insights (Google AI Studio)
DATABASE_URL=file:./dev.db   # SQLite (dev) or postgres:// (prod)
NEXTAUTH_SECRET=...       # any random 32+ char string
```

Without `ODDS_API_KEY`, the app degrades gracefully to mock data. Without
`NEXT_PUBLIC_POSTHOG_KEY`, analytics calls become no-ops. See
[Environment variables](#environment-variables) for the full list.

> **Note**: the Next.js dev server (`bun run dev`) is the **migration target**.
> The current production deployment still runs the legacy `server.js` stack —
> see [Architecture](#architecture--two-coexisting-stacks).

---

## Architecture — two coexisting stacks

PariScore currently runs **two HTTP servers in parallel**. Understanding this is
the single most important thing before touching the code.

### Stack A — Legacy (currently in production)

```
┌─────────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ pariscore.html  │◄────│  server.js (52 435 lines)│────►│  SQLite      │
│ 28 048 lines    │     │  Node http, zero deps    │     │ better-sqlite3│
│ SPA vanilla JS  │     │  serves / + /api/v1/*    │     └──────────────┘
│ admin.html      │     │  + services/*.js (14)    │
└─────────────────┘     └──────────────────────────┘
```

- **`server.js`** (52 435 lines) — Node `http.createServer`, zero npm deps at
  runtime, ships `pariscore.html` on `/`, `admin.html` on `/admin.html`
  (noindex), and the entire `/api/v1/*` surface.
- **`pariscore.html`** (28 048 lines) — vanilla JS SPA, the actual frontend
  users see today in production.
- **`admin.html`** (469 lines) — admin dashboard, robots-disallowed.
- **`services/*.js`** — 14 sport adapters (football, MMA, F1, cycling, CS2,
  NBA/WNBA, Betfair WOM, Betexplorer, Liquipedia, Firecrawl, ML inference, …).
- **`packages/pariscore-services`** — runtime bridge exposing legacy services
  to Next.js API routes (declared in `next.config.ts` `serverExternalPackages`).

This is what `render.yaml`, `Dockerfile`, and PM2 `ecosystem.config.js` deploy.

### Stack B — Next.js 16 App Router (migration target)

```
src/
├── app/            # App Router: layout, page, 23 api/ routes, sitemap, errors
├── components/     # 8 sports + ui/ (shadcn New York) + layout/ + providers/
├── hooks/          # SWR, WebSocket, push, Elo history, toast
├── lib/            # prediction/, push/, tennis-data.ts, db.ts (Prisma)
├── i18n/           # next-intl routing (cookie-based, no URL prefix)
└── messages/       # fr.json, en.json
```

- 23 API routes under `src/app/api/` (tennis, football, cs2, mma, nba, wnba,
  cycling, f1, push, email, sentry-test).
- App entry: `src/app/page.tsx` renders 8 sport tab contents based on
  `type SportTab = "tennis" | "football" | "cs2" | "mma" | "nba" | "wnba" | "cycling" | "f1"`.
- Prisma schema (`prisma/schema.prisma`) is still the default template
  (User + Post) — real business data lives in SQLite tables managed by
  `server.js` and `cron_sps_updater.py`.

### Why both?

The Next.js app is being built feature-by-feature to replace the legacy SPA.
Until parity is reached, production traffic goes to Stack A; Stack B is the
active development surface.

---

## Sports covered

8 sports, each with its own `src/components/<sport>/` folder and (mostly)
`src/app/api/<sport>/` route:

| Sport | Components | Next.js API | Legacy service (`services/*.js`) |
|---|---|---|---|
| 🎾 Tennis | 20+ files (`match-card`, `momentum-dr`, `odds-comparator`, `player-*` …) | `tennis/{prematch,live,backtest,elo-history,player-stats}` | `tnnsLiveScraper.js`, `betfairService.js` |
| ⚽ Football | 5 files (`football-match-card`, `football-tab-content`, …) | `football/{matches,live,prematch}` | (inline in `server.js`, `historique_footballdata.json`) |
| 🥊 MMA | 3 files | `mma/fights` | `mmaService.js`, `mma_fighter_features.json` |
| 🚴 Cycling | 3 files | `cycling` | `cyclingService.js` |
| 🏎️ F1 | 2 files | `f1` | `f1Service.js` |
| 🎮 CS2 | 1 file | `cs2/matches` | `cs2Service.js` |
| 🏀 NBA | 1 file | `nba/matches` | `basketballService.js` |
| 🏀 WNBA | 1 file | `wnba/matches` | `wnbaService.js` |

**Strategies** — 23 betting strategies defined in `server.js` (lines 20816–21034):
18 football (`BTTS_YES`, `OVER_2_5`, `VERROU_TACTIQUE`, `STEAM_DETECTED`, …)
+ 5 tennis (`TENNIS_SERVE_HOLD`, `TENNIS_DR_DOMINANCE`, `TENNIS_SURFACE_SPECIALIST`, …).
Mirrored as typed constants in `packages/shared/src/strategies.ts` (`STRATEGY_KEYS`).

---

## Tech stack

| Layer | Choice |
|---|---|
| **Runtime (prod)** | Bun v1.3+ (`bun run start`) |
| **Framework** | Next.js 16 (App Router, `output: "standalone"`) |
| **UI** | React 19 + TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) + tw-animate-css |
| **i18n** | next-intl 4 (cookie-based, `fr` / `en`) |
| **State** | Zustand (client) + SWR (server cache) + TanStack Query (available) |
| **Forms** | react-hook-form + Zod 4 |
| **Auth** | NextAuth.js v4 |
| **DB** | Prisma 6 → SQLite (dev) / PostgreSQL (prod) via `DATABASE_URL` |
| **Realtime** | socket.io (mini-service on port 3001) |
| **Charts** | Recharts (lazy-loaded) |
| **Email** | Nodemailer (SMTP) |
| **Payments** | Stripe (Matchday Pass + Pro subscriptions) |
| **Analytics** | PostHog (consent-gated, A/B testing) |
| **Errors** | Sentry (client + server + edge, consent-gated) |
| **AI** | Gemini 2.0 Flash (deep insights, strategy narratives) |
| **PWA** | `public/manifest.json` + `public/sw.js` + Web Push (VAPID) |
| **E2E** | Playwright (~51 tests, 8 files) |
| **Load** | k6 (4 scenarios) |
| **Security scan** | Semgrep + Trail of Bits rules (weekly SAST) |

---

## Project layout

```
pariscore/
├── server.js                  # 52 435 lines — legacy HTTP backend (production)
├── pariscore.html             # 28 048 lines — legacy SPA
├── admin.html                 # admin console
├── services/                  # 14 legacy sport adapters (.js)
├── src/                       # Next.js 16 App Router (migration target)
│   ├── app/                   # layout, page, api/ (23 routes), errors
│   ├── components/            # 8 sports/ + ui/ + layout/
│   ├── hooks/                 # SWR, WebSocket, push, Elo
│   ├── lib/                   # prediction/, push/, db.ts (Prisma)
│   ├── i18n/                  # routing.ts, request.ts
│   └── messages/              # fr.json, en.json
├── packages/                  # workspaces
│   ├── pariscore-services/    # Next.js ↔ legacy services bridge
│   └── shared/                # @pariscore/shared (strategies, types)
├── mini-services/
│   └── tennis-live/           # socket.io WebSocket service (:3001)
├── scripts/                   # sofa-microservice.py, fetch-tennis-data.ts, …
├── cron_sps_updater.py        # Surface PowerScore pipeline (every 12h)
├── prisma/                    # schema.prisma
├── locales/                   # 7 languages for legacy frontend
├── tests/                     # Playwright *.spec.ts + k6 script.js
├── public/                    # manifest.json, sw.js, icons
├── render.yaml                # Render.com Blueprint (2 services)
├── Dockerfile                 # multi-stage Node 22-alpine
├── docker-compose.prod.yml    # prod compose
├── ecosystem.config.js        # PM2 (7 processes)
├── Caddyfile                  # reverse proxy (VPS)
└── .github/workflows/         # 7 CI workflows
```

Full tree: see `graphify-out/GRAPH_REPORT.md` (generated, gitignored) or run
`graphify query "<module>"`.

---

## Environment variables

All variables are **optional** at boot — the app degrades gracefully. Copy
`.env.example` to `.env` and fill what you need.

### Critical (required for non-mocked experience)

| Variable | Scope | Purpose |
|---|---|---|
| `API_FOOTBALL_KEY` | server | api-football.com — football fixtures + odds (`x-apisports-key` header) |
| `ODDS_API_KEY` | server | the-odds-api.com — multi-sport odds |
| `GEMINI_API_KEY` | server | Google AI Studio — Gemini 2.0 Flash for insights |
| `DATABASE_URL` | both | SQLite path (`file:./dev.db`) or PostgreSQL URL |
| `NEXTAUTH_SECRET` | server | NextAuth session signing (32+ random chars) |

### Sport data APIs

| Variable | Purpose |
|---|---|
| `THERUNDOWN_API_KEY`, `PROPLINE_API_KEY`, `CLOUDBET_API_KEY` | Alternative odds providers |
| `BSD_API_KEY`, `BSD_TENNIS_ENABLED` | Bzzoiro Sports Data add-on (used by MCP + tennis routes) |
| `BSD_LIVE_TOKEN`, `BSD_LIVE_WS_*` | BSD live WebSocket streaming |
| `RAPIDAPI_KEY`, `SPORTDB_API_KEY`, `THESPORTSDB_KEY`, `TSDB_API_KEY` | Sport DBs (also consumed by MCP servers) |
| `SPORTMONKS_API_KEY`, `FOOTBALL_DATA_API_KEY`, `FREE_FOOTBALL_RAPIDAPI_KEY` | Football data sources |
| `MATCHSTAT_API_KEY`, `ODDSPAPI_V4_KEY`, `GAMEFORECAST_*`, `PARLAY_*` | Additional odds/forecast providers |

### AI / LLM

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | (see Critical) Gemini 2.0 Flash streaming |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY` | Alternative LLM backends |
| `AI_AL_FUNCTION_CALLING` | Toggle function-calling mode |

### Auth & admin

| Variable | Purpose |
|---|---|
| `JWT_SECRET`, `ADMIN_PASSWORD`, `BETA_TESTER_PASSWORD` | Legacy auth gates |
| `HISTORY_AUTH_REQUIRED`, `MATCHES_AUTH_BYPASS`, `COOKIE_SECURE` | Route-level auth flags |

### Payments (Stripe)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe core |
| `STRIPE_MATCHDAY_PRICE_ID`, `STRIPE_PRICE_PRO_{MONTHLY,ANNUAL,FOOT,TENNIS,DUO_*}` | Product price IDs |
| `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL` | Redirect URLs |

### Notifications

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push (VAPID) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Transactional email |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`, `TENNIS_TELEGRAM_CHAT_IDS` | Telegram alerts |
| `DISCORD_*_WEBHOOK_URL` (10+ keys) | Discord webhooks (morning picks, live tennis, foot xG, …) |

### Observability

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Error tracking |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (sitemap, robots, JSON-LD, OG) |

### Betfair exchange (geo-blocked, optional)

| Variable | Purpose |
|---|---|
| `BETFAIR_USER`, `BETFAIR_PASS`, `BETFAIR_APP_KEY`, `BETFAIR_DISABLED` | Weight-of-Money exchange integration |

### Scraping & ML

| Variable | Purpose |
|---|---|
| `SOFA_SERVICE_BASE`, `SOFA_PORT`, `SOFA_BIND` | Sofa microservice config |
| `FLARESOLVERR_URL`, `CURL_IMPERSONATE_BIN`, `USE_CURL_IMPERSONATE` | Anti-bot bypass |
| `SCRAPLING_PROXY_URL`, `SCRAPLING_SOLVE_CAPTCHA_API_KEY`, `SCRAPLING_ENABLED` | Scrapling MCP |
| `FIRECRAWL_API_KEY`, `FIRECRAWL_ENABLED`, `GNEWS_API_KEY` | News content |
| `CATBOOST_ENABLED`, `CATBOOST_PYTHON_BIN`, `EDA_PYTHON_BIN` | ML inference |

### Runtime tuning (advanced)

Boot timeouts, rate limits, cache TTLs, debug flags, and live-tuning vars
(`BOOT_ODDS_TIMEOUT_MS`, `API_RATE_LIMIT_MAX`, `CACHE_TTL_*`, `LIVE_FOOT_POISSON_*`,
`PS_DEBUG_ELO`, `VALUE_ALERT_INTERVAL_MS`, …). ~50 vars total — see inline
comments in `server.js` and `.env.example` for the exhaustive list.

Generate VAPID keys:

```bash
bunx web-push generate-vapid-keys
```

---

## Common commands

```bash
# Dev
bun run dev                              # Next.js dev server on :3000 (logs to dev.log)

# Production
bun run build                            # next build + copy static + public to standalone
bun run start                            # node scripts/run-bun.js .next/standalone/server.js

# Quality
bun run lint                             # ESLint 9
bun run test                             # tests via Bun
bun run qa:node                          # node-side QA checks (scripts/qa-node-check.js)

# Database (Prisma)
bun run db:push                          # push schema
bun run db:generate                      # generate client
bun run db:migrate                       # create + apply migration
bun run db:reset                         # drop + recreate

# Mini-services
cd mini-services/tennis-live && bun run dev   # WebSocket service on :3001

# Legacy backend (production stack)
node server.js                           # serves pariscore.html + /api/v1/* on $PORT (default 3000)

# Testing
bunx playwright test                     # Playwright E2E suite (~51 tests, 8 files)
K6_SCENARIO=api_load k6 run tests/load/script.js   # k6 load test (4 scenarios)

# Tennis Elo data refresh
bun run scripts/fetch-tennis-data.ts            # regenerate src/lib/prediction/elo-data.json
bun run scripts/fetch-tennis-data.ts --dry-run  # download + compute, no write
```

---

## Mini-services & cron jobs

| Service | Port / Schedule | Purpose |
|---|---|---|
| **`mini-services/tennis-live/`** | `:3001` (socket.io) | Point-by-point tennis scoring simulation, 5s tick |
| **`scripts/sofa-microservice.py`** | `:8765` (Python HTTP) | Sofascore scraping (live, momentum, shotmap, incidents) — called by `pariscore-sofa` Render pserv |
| **`cron_sps_updater.py`** | every 12h (cron) | Surface PowerScore (SPS) pipeline — refreshes `player_surface_scores` table |
| **`betfairService.js`** | — (library) | Betfair exchange WOM adapter, inert if `BETFAIR_*` unset |
| **`packages/pariscore-services`** | — (npm workspace) | Runtime bridge: Next.js API routes → legacy `services/*.js` |

PM2 processes (see `ecosystem.config.js` — 7 total):

```
pariscore                  # main HTTP server
pariscore-cron-rg          # football Ranking/Golden generation
pariscore-cron-match-stats # match stats refresh
pariscore-vault-daily      # daily summary vault
pariscore-vault-weekly     # weekly review vault
pariscore-cron-cycling     # cycling pipeline
pariscore-cron-sps         # Surface PowerScore (Python wrapper)
```

---

## Deployment

Three supported targets. Pick based on your hosting model.

### 1. Render.com (Blueprint)

`render.yaml` describes 2 services:

| Service | Type | Runtime | Start command |
|---|---|---|---|
| `pariscore-sofa` | `pserv` (private) | Python | `python scripts/sofa-microservice.py` (port 8765) |
| `pariscore` | `web` | Node | `node server.js` (port 3000, disk 1 GB) |

To deploy: push to GitHub → connect repo to Render → Render auto-creates services
from the Blueprint → set env vars in dashboard. Health check: `/api/v1/status`.

### 2. Docker (local + prod)

- `Dockerfile` — multi-stage Node 22-alpine, runs `node server.js`, non-root user
  `pariscore`, copies `server.js pariscore.html admin.html services/ assets/`.
- `Dockerfile.sofa` — Python image for the Sofa microservice.
- `docker-compose.prod.yml` — prod compose (pariscore + sofa).
- `docker-compose.yml` — local dev.

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. VPS bare-metal (PM2 + Caddy)

Target documented in `AGENTS.md`: `ubuntu@51.75.21.239` with Bun + pm2.

```bash
# Sync code
bash scripts/update_vps.sh

# Start all 7 PM2 processes
pm2 start ecosystem.config.js

# Reverse proxy + TLS via Caddy
caddy run --config Caddyfile
```

### Health check

All targets expose:

```
GET /api/v1/status
```

---

## CI/CD

7 GitHub Actions workflows in `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| **CI** | `ci.yml` | push/PR | Backend Python (pytest) + frontend (tsc + build) |
| **Build** | `build.yml` | push/PR | Next.js standalone build via Bun |
| **Lint** | `lint.yml` | push/PR | ESLint via Bun |
| **E2E** | `e2e.yml` | push/PR | Playwright 51 specs against prod standalone |
| **Load Test** | `load-test.yml` | push/PR | k6 (4 scenarios) |
| **Refresh Elo** | `refresh-elo.yml` | cron monthly (1st, 03:00 UTC) | Regenerate `src/lib/prediction/elo-data.json`, auto-commit if changed |
| **Semgrep SAST** | `semgrep-tob.yml` | cron weekly (Mon 06:00 UTC) | Semgrep + Trail of Bits rules, SARIF to GitHub Security |

---

## Internationalization

Two i18n surfaces (one per stack):

- **Next.js (Stack B)** — `next-intl 4`, cookie-based, `localePrefix: "never"`.
  Locales: `fr` (default), `en`. Strings in `src/messages/{fr,en}.json`.
- **Legacy (Stack A)** — separate `locales/` folder with **7 languages**:
  `de`, `en`, `es`, `fr`, `it`, `nl`, `pt`.

All user-facing strings in Stack B flow through `useTranslations()`. Locale is
driven by the `NEXT_LOCALE` cookie.

---

## Testing

| Suite | Tool | Scope |
|---|---|---|
| E2E | Playwright (`@playwright/test ^1.61.1`) | 51 tests across 8 files: `api`, `detail-dialog`, `filters`, `match-card`, `mobile`, `rgpd`, `smoke`, `theme-language` |
| Load | k6 | 4 scenarios in `tests/load/script.js` |
| Security | Semgrep + Trail of Bits | Weekly SAST, SARIF uploaded to GitHub Security tab |
| Strategies | `tests/strategies.test.ts` + `tests/test_strategies.py` | Validates `STRATEGY_KEYS` ↔ `STRATEGIES` sync |

```bash
bunx playwright test                          # all 51 E2E tests
bunx playwright test tests/rgpd.spec.ts       # RGPD consent flow only
K6_SCENARIO=api_load k6 run tests/load/script.js
```

---

## PWA & Web Push

- **`public/manifest.json`** — standalone display, icons 192/512, app shortcuts.
- **`public/sw.js`** (cache `v4`) — cache-first for static assets, network-first
  for API. Registered only in production (`src/components/sw-register.tsx`).
- **Web Push** — VAPID-based value-bet alerts via the SW push handler.
  Subscribe via `POST /api/push/subscribe`. Test via `POST /api/push/test`.
- **Email digests** — optional, via `POST /api/email/subscribe`.

> The manifest and SW still carry the legacy product name `SetPoint` — see
> [License & data sources](#license--data-sources) note. Functional behavior
> is unaffected.

---

## Developer tooling

PariScore ships with a rich agent-IA development environment. See `AGENTS.md`
for the canonical reference.

- **14 MCP servers** declared in `.mcp.json` (filesystem, memory, git,
  playwright, sportradar, bzzoiro-sports, sportdbdotdev, frontendchecklist,
  stitch, crawl4ai, scrapling, scrapy, agentmemory, shadcn).
- **154 agent skills** under `.agents/tools/` (shared with OpenCode via a
  Windows junction at `.opencode/skills/`). Sync with
  `node scripts/sync-skills.js`.
- **Knowledge graph** via `graphify` (CLI at `~/.local/bin/graphify.exe`,
  output in `graphify-out/`, gitignored). Query code relationships with
  `graphify query "<question>"`, `graphify path "<A>" "<B>"`,
  `graphify explain "<concept>"`.
- **Issue tracker** — `bd` (beads) for durable task tracking. Run `bd prime`.

---

## Further documentation

| Document | What it covers |
|---|---|
| **[AGENTS.md](./AGENTS.md)** | Workspace instructions for AI agents (MCP, skills, conventions, deploy). |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | High-level diagram, data flow, prediction engine, RGPD consent, PWA, push, WebSocket, security. |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Setup, conventions, testing, commit & PR workflow, full project tree. |
| **[CHANGELOG.md](./CHANGELOG.md)** | Detailed change log by version. |
| **[CLAUDE.md](./CLAUDE.md)** | Full roadmap, version history, persona context. |
| **[LICENSE-DATA.md](./LICENSE-DATA.md)** | Data source transparency (upstream licenses, attribution). |
| **[render.yaml](./render.yaml)** | Render.com Blueprint deploy config. |

---

## License & data sources

**Code license**: not yet formalized in a top-level `LICENSE` file. The legacy
README carried a `MIT` badge; until a `LICENSE` file lands, treat the code
license as TBD. See `LICENSE-DATA.md` for data-source attribution and upstream
license notes.

**Player photos** in `src/lib/tennis-data.ts` (`PHOTO_URLS`) and
`tennis-player-photos.json` are demo images sourced via image search —
**replace with a licensed ATP/WTA photo CDN before any public deployment**.

**Data sources**: ATP/WTA match CSVs (Jeff Sackmann), api-football.com,
the-odds-api.com, Sofascore (via `sofa-microservice.py`), Betfair Exchange
(geo-blocked), BSD Bzzoiro add-on, plus scrapers (Scrapling, Scrapy,
Firecrawl). Each upstream's terms of service apply.
