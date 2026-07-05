# SetPoint · Tennis Prematch

> Tennis pre-match win-probability predictions powered by an Elo + Form +
> Surface + H2H model — a Next.js 16 PWA with RGPD-compliant analytics,
> WebSocket live updates, and Web Push value-bet alerts.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)
[![shadcn/ui](https://img.shields.io/badge/shadcn--ui-New%20York-black)](https://ui.shadcn.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## Documentation

| Document | What it covers |
|---|---|
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Setup, conventions, testing, how to add matches / languages / API routes / components, commit & PR workflow, deployment. |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | High-level diagram, data flow, prediction engine, Elo history, RGPD consent, PWA, push, WebSocket service, performance, security. |
| **[download/README-integration.md](./download/README-integration.md)** | Integration guide for porting the MatchCard component into another Next.js / React / Vue / Angular site. |
| **[worklog.md](./worklog.md)** | Chronological decision log of every iteration (v2 → v6 + mini-services). |

---

## Quick start

```bash
bun install                         # 1. install deps
cp .env.example .env                # 2. configure (all keys optional)
bun run dev                         # 3. start dev server on :3000
```

The dev server is auto-started by the sandbox — you usually don't need step 3
yourself. All env vars are optional: the app degrades gracefully to mock data
when `ODDS_API_KEY` is absent and to no-op analytics when `POSTHOG_KEY` is
absent.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| i18n | next-intl 4 (cookie-based, `fr` / `en`, no URL prefix) |
| State | SWR (server) + Zustand (client) + TanStack Query (available) |
| Auth | NextAuth.js v4 (available) |
| DB | Prisma + SQLite |
| Realtime | socket.io (mini-service on port 3001) |
| Charts | Recharts (lazy-loaded) |
| Analytics | PostHog (consent-gated, A/B testing) |
| Errors | Sentry (client + server + edge, consent-gated) |
| PWA | manifest.json + sw.js + Web Push (VAPID) |
| E2E | Playwright (~51 tests, 8 files) |
| Load | k6 (4 scenarios) |
| CI/CD | GitHub Actions (lint / build / e2e / load-test / refresh-elo) |

---

## Features

- **Prediction engine** — Elo (70%) + Form (20%, exp-decay 0.85ⁱ) + H2H (10%),
  surface-blended (55% surface / 45% overall), with 95% CI via 1000-sample
  parametric bootstrap.
- **Elo history charts** — 12-month progression per player, reverse-computed
  from current Elo via 3 fixed-point iterations.
- **Multi-bookmaker odds comparator** — 5 bookmakers per match, vig-removed
  implied probabilities, best-value highlight.
- **H2H detail tab** — past matchups with date, tournament, surface, score.
- **Live WebSocket updates** — socket.io mini-service on port 3001 simulates
  point-by-point scoring every 5s; live probability overrides the static one.
- **RGPD consent** — 3-level banner (all / analytics-only / reject) +
  6-section privacy dialog. PostHog and Sentry are both gated behind
  `consent.analytics`. Consent persisted in localStorage + 180-day cookie.
- **PWA** — installable, offline-capable (cache-first static, network-first
  API), service worker registered in production only.
- **Web Push** — VAPID-based value-bet alerts via the service worker push
  handler.
- **i18n FR / EN** — every user-facing string flows through `useTranslations()`;
  locale driven by the `NEXT_LOCALE` cookie.
- **A/B testing** — PostHog experiment `tennis-prematch-chips-layout`
  (`chips_visible` vs `chips_collapsed`).
- **Sentry error monitoring** — client / server / edge SDKs, client events
  dropped until analytics consent granted; user feedback widget.
- **Custom error pages** — branded 404 + 500 with retry/home actions.
- **SEO** — dynamic sitemap, robots.txt, WebApplication + SportsEvent JSON-LD,
  OpenGraph + Twitter meta.
- **Responsive** — mobile-first; tested at 390×844 (iPhone) and 1280×900
  (desktop).
- **Accessibility** — semantic HTML, ARIA labels, keyboard navigation,
  role-based E2E selectors.

---

## Environment variables

All optional — the app runs with zero configuration. Copy `.env.example` to
`.env` and fill what you need.

| Variable | Scope | Purpose |
|---|---|---|
| `ODDS_API_KEY` | server | The Odds API key. Without it, `/api/tennis/prematch` serves mock data. |
| `NEXT_PUBLIC_POSTHOG_KEY` | client | PostHog project key. Without it, `track()` is no-op and A/B defaults to `chips_visible`. |
| `NEXT_PUBLIC_POSTHOG_HOST` | client | PostHog host (self-hosted). Default `https://app.posthog.com`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | VAPID public key for Web Push. |
| `VAPID_PRIVATE_KEY` | **server only** | VAPID private key. Never expose in client code. |
| `VAPID_SUBJECT` | server | `mailto:` / `https:` URL identifying the push sender. |
| `SENTRY_DSN` | server | Sentry DSN (Node runtime). |
| `NEXT_PUBLIC_SENTRY_DSN` | client | Sentry DSN (browser). Usually the same as `SENTRY_DSN`. |
| `SENTRY_ORG` | CI only | Sentry org slug (source-map upload). |
| `SENTRY_PROJECT` | CI only | Sentry project slug (source-map upload). |
| `NEXT_PUBLIC_SITE_URL` | both | Absolute canonical URL (no trailing slash). Used by sitemap, robots, JSON-LD, OG/Twitter. Default `https://setpoint.example`. |

Generate VAPID keys: `bunx web-push generate-vapid-keys`

---

## Common commands

```bash
bun run dev              # dev server (auto-started in sandbox)
bun run lint             # ESLint
bun run build            # standalone production build → .next/standalone/
bunx playwright test     # E2E suite (~51 tests)
K6_SCENARIO=api_load k6 run tests/load/script.js   # load test
cd mini-services/tennis-live && bun run dev        # WebSocket service (:3001)
```

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the full workflow.

---

## Data refresh

`src/lib/prediction/elo-data.json` (6 players, ~77 KB, 1,042 Elo points) is
regenerated from Jeff Sackmann's ATP + WTA match CSVs by
`scripts/fetch-tennis-data.ts` (downloads the last 3 years, computes Elo with
K=32 / denom=400 / startElo=1500, runs in ~30 s).

A GitHub Actions cron workflow (`.github/workflows/refresh-elo.yml`) refreshes
the file **automatically on the 1st of each month at 03:00 UTC**. If the JSON
changed, the `github-actions[bot]` commits it back to `main` with
`chore(data): refresh Elo data [skip ci]` — the `[skip ci]` token prevents
re-triggering the lint / build / e2e / load-test workflows.

**Trigger it manually** (Actions tab → *Refresh Elo* → *Run workflow*):

```bash
# From a local clone with `gh` installed
gh workflow run refresh-elo.yml

# With the optional dry-run checkbox (download + compute, no commit)
gh workflow run refresh-elo.yml -f dry_run=true
```

**Run locally**:

```bash
bun run scripts/fetch-tennis-data.ts            # regenerate + write JSON
bun run scripts/fetch-tennis-data.ts --dry-run   # download + compute, no write
```

If a download fails on any year, the script exits non-zero **without
overwriting** the existing JSON — CI surfaces the failure and the app keeps
serving the previous month's data.

---

## Project layout (abridged)

```
src/
├── app/              # App Router: layout, page, api/, error pages, sitemap
├── components/       # ui/ (shadcn), tennis/, providers, consent, feedback…
├── hooks/            # SWR, WebSocket, push, Elo history, toast
├── lib/              # prediction/, push/, tennis-data.ts, db.ts
├── i18n/             # routing.ts, request.ts (cookie-based)
└── messages/         # fr.json, en.json
mini-services/tennis-live/   # socket.io on :3001
tests/                # *.spec.ts (Playwright) + load/script.js (k6)
.github/workflows/    # lint, build, e2e, load-test
```

Full tree in **[CONTRIBUTING.md §5](./CONTRIBUTING.md#5-code-structure)**.

---

## License

MIT © SetPoint contributors. See `LICENSE` file for details (to be added
before public release).

> **Note**: player photos in `src/lib/tennis-data.ts` (`PHOTO_URLS`) are demo
> images sourced via image search and hosted on `sfile.chatglm.cn`. Replace
> them with a licensed ATP/WTA photo CDN before any public deployment.
