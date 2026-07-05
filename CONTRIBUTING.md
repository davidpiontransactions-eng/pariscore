# Contributing to SetPoint

Thanks for your interest in contributing to **SetPoint — Tennis Prematch**! This
guide covers everything you need to set up the project locally, follow our
conventions, and ship changes that pass CI.

> **Short version**: `bun install` → copy `.env.example` to `.env` →
> `bun run dev` → `bun run lint` before committing. Everything else is below.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Setup](#2-setup)
3. [Development](#3-development)
4. [Mini-service WebSocket (optional)](#4-mini-service-websocket-optional)
5. [Code structure](#5-code-structure)
6. [Coding conventions](#6-coding-conventions)
7. [Testing](#7-testing)
8. [Adding a new match](#8-adding-a-new-match)
9. [Adding a new language](#9-adding-a-new-language)
10. [Adding a new API route](#10-adding-a-new-api-route)
11. [Adding a new component](#11-adding-a-new-component)
12. [Commit conventions](#12-commit-conventions)
13. [Pull requests](#13-pull-requests)
14. [Deployment](#14-deployment)

---

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| [bun](https://bun.sh) | **1.1+** | Package manager + runtime. All scripts in `package.json` assume bun. |
| [Node.js](https://nodejs.org) | **20+** | Required by Next.js 16 toolchain and `next build`. |
| [k6](https://k6.io) | latest | Load tests (`tests/load/script.js`). Install via `brew install k6` or the [official binary](https://k6.io/docs/get-started/installation/). |
| [Playwright](https://playwright.dev) | bundled | E2E tests. Run `bunx playwright install --with-deps chromium` once after install. |
| Git | any | Version control. |

Verify your setup:

```bash
bun --version    # >= 1.1.0
node --version   # >= 20
k6 version       # optional, only for load tests
```

---

## 2. Setup

```bash
# 1. Clone
git clone <repo-url> setpoint
cd setpoint

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# → edit .env and fill the keys you need (see table below)

# 4. (optional) Install Playwright browser
bunx playwright install --with-deps chromium
```

### Environment variables

Copy `.env.example` to `.env`. All keys are **optional** — the app degrades
gracefully when any of them is missing.

| Variable | Required? | Purpose |
|---|---|---|
| `ODDS_API_KEY` | optional | The Odds API key. When unset, `/api/tennis/prematch` returns enriched mock data (source: `"mock"`). |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | PostHog project key. When unset, all `track()` calls are no-op and the A/B test variant defaults to `chips_visible`. |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | PostHog host (self-hosted instances). Defaults to `https://app.posthog.com`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optional | VAPID public key for Web Push. Client-side. |
| `VAPID_PRIVATE_KEY` | optional (server-only) | VAPID private key. **Never** expose in client code. |
| `VAPID_SUBJECT` | optional | `mailto:` or `https:` URL identifying the push sender. |
| `SENTRY_DSN` | optional | Server-side Sentry DSN. |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Client-side Sentry DSN (usually the same value). |
| `SENTRY_ORG` / `SENTRY_PROJECT` | optional | Only needed for source-map upload in CI. |
| `NEXT_PUBLIC_SITE_URL` | optional | Absolute canonical URL (no trailing slash). Used by sitemap, robots, JSON-LD, OG/Twitter meta. Falls back to `https://setpoint.example`. |

Generate VAPID keys with:

```bash
bunx web-push generate-vapid-keys
```

---

## 3. Development

In this sandbox the dev server is **auto-started by the system** on port 3000.
You do **not** need to run it yourself — and per project rules you should not.

If you are working on your own machine:

```bash
bun run dev      # starts `next dev -p 3000`
```

The dev server:

- Listens on **http://localhost:3000**
- Hot-reloads on file changes
- Writes logs to `dev.log` at the project root (useful for debugging SSR errors)
- Runs in `development` mode, so the service worker is **not** registered
  (see `src/components/sw-register.tsx` — `process.env.NODE_ENV !== "production"`
  guard)

### Lint

```bash
bun run lint     # ESLint (eslint-config-next core-web-vitals + typescript)
```

Must pass with zero errors before opening a PR. CI runs the same command.

---

## 4. Mini-service WebSocket (optional)

Live score updates are powered by an **independent Bun project** in
`mini-services/tennis-live/`. It is **optional** — the main app degrades
gracefully (the page simply shows static prematch probabilities without live
overlay).

To run it locally:

```bash
cd mini-services/tennis-live
bun install        # first time only
bun run dev        # `bun --hot index.ts` on port 3001
```

What it does:

- HTTP + `socket.io` server on **hardcoded port 3001**, path `/`
- On client connect → emits `initial_state` (`LiveMatchState[]`)
- Every **5 s** → advances one match (round-robin) by one simulated point,
  broadcasts `match_update` (`LiveMatchState`)
- Emits `pong` in response to a `ping` event (latency probe)
- Graceful shutdown on `SIGTERM` / `SIGINT`

The frontend connects via the Caddy gateway with
`io("/?XTransformPort=3001")` — **never** `io("http://localhost:3001")`.

Files of interest:

- `mini-services/tennis-live/index.ts` — server implementation
- `src/hooks/use-live-matches.ts` — client hook (auto-reconnect, 5s stale guard)
- `Caddyfile` — gateway rewrite rule for `?XTransformPort=3001`

---

## 5. Code structure

```
setpoint/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # Route handlers
│   │   │   ├── tennis/prematch/route.ts     # GET prematch matches (60s cache)
│   │   │   ├── tennis/elo-history/route.ts  # GET Elo history per match
│   │   │   ├── push/subscribe/route.ts      # POST push subscription
│   │   │   └── sentry-test/route.ts         # ⚠️ temp smoke-test, remove before prod
│   │   ├── layout.tsx            # Root layout (providers tree)
│   │   ├── page.tsx              # The single visible route `/`
│   │   ├── error.tsx             # 500 error boundary (Sentry captureException)
│   │   ├── global-error.tsx      # Root error fallback (no providers)
│   │   ├── not-found.tsx         # Custom 404
│   │   ├── loading.tsx           # Route segment loader
│   │   ├── sitemap.ts            # Dynamic sitemap.xml
│   │   └── globals.css           # Tailwind 4 + theme tokens
│   ├── components/               # App-level components
│   │   ├── ui/                   # shadcn/ui primitives (New York style)
│   │   ├── tennis/               # Domain components (MatchCard, OddsComparator…)
│   │   ├── analytics-provider.tsx     # PostHog (consent-gated)
│   │   ├── consent-provider.tsx       # RGPD consent state (localStorage + cookie)
│   │   ├── consent-banner.tsx         # 3-level consent UI
│   │   ├── privacy-dialog.tsx         # 6-section privacy policy modal
│   │   ├── sentry-error-boundary.tsx  # React error boundary → Sentry
│   │   ├── feedback-widget.tsx        # Floating bug/feedback reporter
│   │   ├── sw-register.tsx            # PWA service worker (prod only)
│   │   ├── push-toggle.tsx            # Push subscription toggle
│   │   ├── theme-toggle.tsx           # Dark/light
│   │   └── language-toggle.tsx        # FR/EN
│   ├── hooks/                    # Client hooks (SWR, WebSocket, push, Elo history)
│   ├── lib/
│   │   ├── prediction/           # engine.ts + elo-history.ts
│   │   ├── push/store.ts         # In-memory push subscription store
│   │   ├── tennis-data.ts        # Types + MATCHES array + PHOTO_URLS
│   │   ├── db.ts                 # Prisma client
│   │   └── utils.ts              # cn() helper
│   ├── i18n/
│   │   ├── routing.ts            # next-intl routing (locales, defaultLocale)
│   │   └── request.ts            # locale resolution (NEXT_LOCALE cookie)
│   └── messages/                 # i18n JSON catalogs
│       ├── fr.json
│       └── en.json
├── prisma/schema.prisma          # Prisma schema (SQLite)
├── public/                       # Static assets (manifest.json, sw.js, icons, robots.txt)
├── tests/
│   ├── *.spec.ts                 # Playwright E2E (8 files, ~51 tests)
│   ├── page-objects.ts           # Playwright page-object helpers
│   └── load/script.js            # k6 load tests (4 scenarios)
├── mini-services/tennis-live/    # WebSocket live-updates microservice (port 3001)
├── scripts/                      # Python helpers (photo fetcher, PWA icons, validation)
├── examples/                     # WebSocket reference implementation
├── .github/workflows/            # CI: lint, build, e2e, load-test
├── .env.example
├── Caddyfile                     # Gateway config (XTransformPort routing)
├── eslint.config.mjs
├── playwright.config.ts
└── package.json
```

---

## 6. Coding conventions

### TypeScript

- **Strict mode** everywhere. No implicit `any` (the lint rule is relaxed but
  reviewers will ask you to type things properly).
- Use `type` for unions/primitives, `interface` for object shapes you may
  extend.
- Prefer named exports. Default exports are reserved for route/page components
  (Next.js convention).

### React hooks & effects

The ESLint `react-hooks/set-state-in-effect` rule (shipped with Next.js 16)
forbids calling `setState` synchronously inside `useEffect`. **Defer it with a
microtask**:

```tsx
// ❌ Bad — fires during render commit, triggers lint error
useEffect(() => {
  setState(readConsent());
}, []);

// ✅ Good — deferred to a microtask
useEffect(() => {
  Promise.resolve().then(() => {
    setState(readConsent());
    setHydrated(true);
  });
}, []);
```

See `src/components/consent-provider.tsx` and
`src/hooks/use-push-notifications.ts` for canonical examples.

### Styling

- **Tailwind CSS 4** for all styling. Tokens (`bg-background`,
  `text-foreground`, `bg-primary`…) are defined in `src/app/globals.css`.
- **shadcn/ui (New York style)** for primitives — do not build a new Button,
  Dialog, Select, etc. from scratch. Compose the ones in `src/components/ui/`.
- **Responsive**: mobile-first. Default classes target mobile, then layer
  `sm:` / `md:` / `lg:` / `xl:` overrides.
- **Touch targets**: minimum 44×44 px for any clickable element.
- **No indigo or blue** as primary brand colors unless explicitly requested.
  The SetPoint accent is emerald (`#10b981`, see `viewport.themeColor`).
- **Sticky footer**: if a page has a `<footer>`, the root layout must use
  `min-h-screen flex flex-col` and the footer gets `mt-auto`.

### Internationalization (i18n)

- Every user-facing string goes through `useTranslations()` from `next-intl`.
- **Never hardcode** French or English text in components.
- Keys live in `src/messages/{locale}.json`. Both `fr.json` and `en.json` must
  stay in sync — a missing key in one locale will render the raw key path.
- Example:

```tsx
const t = useTranslations("matchCard");
return <Button>{t("betCta")}</Button>;
```

```json
// src/messages/fr.json
{ "matchCard": { "betCta": "Parier" } }
// src/messages/en.json
{ "matchCard": { "betCta": "Bet" } }
```

### Accessibility

- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>`, `<header>`,
  `<footer>`.
- Every interactive element needs an accessible name (`aria-label` or visible
  text). Icon-only buttons **must** have `aria-label`.
- All clickable elements must be keyboard-reachable with a visible focus ring.
- E2E tests use **role-based selectors** (`getByRole`, `getByLabel`) rather
  than CSS classes — see `tests/page-objects.ts`. Keep selectors stable.

### Mobile-first responsive

Default to mobile layout, then enhance:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

Test on 390×844 (iPhone-sized) before opening a PR. The
`tests/mobile.spec.ts` suite enforces this.

### Performance

- **Lazy-load** heavy components with `next/dynamic` (e.g.
  `MatchDetailDialog` pulls in Recharts ~200 KB — only load when opened).
- **Preconnect** to external origins used above the fold (already wired in
  `src/app/layout.tsx` for `sfile.chatglm.cn` and `app.posthog.com`).
- Use `fetchpriority="high"` on the LCP image, `loading="lazy"` on the rest.
- Server components by default; mark `"use client"` only when you need hooks,
  browser APIs, or event handlers.

### Security

- All client `fetch` calls use **relative URLs** (`/api/...`). The Caddy
  gateway rewrites cross-port requests via `?XTransformPort=3001`.
  - **Never** write `fetch("http://localhost:3001/...")` in client code.
- `VAPID_PRIVATE_KEY` is server-only. Never import it (or any non-
  `NEXT_PUBLIC_` var) from a client component.
- PostHog is initialized with `respect_dnt: true` and `autocapture: false`.
- Sentry's client `beforeSend` drops events unless the user granted analytics
  consent (reads `setpoint-consent` from `localStorage`).

---

## 7. Testing

### Lint

```bash
bun run lint
```

Zero errors required. CI runs this on every push and PR to `main`.

### E2E (Playwright)

```bash
# Install browser (first time)
bunx playwright install --with-deps chromium

# Run all specs
bunx playwright test

# Run a single file
bunx playwright test tests/smoke.spec.ts

# Open the HTML report
bunx playwright show-report
```

The suite has **8 spec files / ~51 tests**:

| File | Covers |
|---|---|
| `tests/smoke.spec.ts` | Page loads, SSR, hydration, key sections present |
| `tests/api.spec.ts` | `/api/tennis/prematch` + `/api/tennis/elo-history` contracts |
| `tests/match-card.spec.ts` | MatchCard rendering, probability ring, CTA |
| `tests/filters.spec.ts` | Filter bar (Tous / Favoris clairs / Matchs serrés) |
| `tests/detail-dialog.spec.ts` | MatchDetailDialog tabs (Form / H2H / Odds) |
| `tests/mobile.spec.ts` | Responsive layout at 390×844 |
| `tests/theme-language.spec.ts` | Theme toggle + FR/EN language toggle |
| `tests/rgpd.spec.ts` | Consent banner 3 levels + PostHog gating |

The dev server (port 3000) must be running. `playwright.config.ts` does **not**
start a webServer — it reuses the already-running instance.

### Load (k6)

```bash
# Single scenario
K6_SCENARIO=smoke      k6 run tests/load/script.js
K6_SCENARIO=api_load   k6 run tests/load/script.js
K6_SCENARIO=elo_stress k6 run tests/load/script.js
K6_SCENARIO=mixed      k6 run tests/load/script.js

# All four scenarios concurrently
k6 run tests/load/script.js
```

| Scenario | VUs | Duration | Endpoint(s) |
|---|---|---|---|
| `smoke` | 10 | ≤30 s | `GET /` (1 iter each) |
| `api_load` | 50 | 60 s | `GET /api/tennis/prematch` |
| `elo_stress` | 20 | 45 s | `GET /api/tennis/elo-history?matchId=m1` |
| `mixed` | ramp 0→20→20→0 | 2 min | 60% `/` · 30% prematch · 10% elo-history |

Override the base URL with `-e BASE_URL=http://host:port`.

---

## 8. Adding a new match

Matches are declared in `src/lib/tennis-data.ts` in the `MATCHES` array. To add
a new one:

1. **Add player photos** to the `PHOTO_URLS` record (top of the file). Use a
   licensed CDN URL in production — the current ones are demo photos on
   `sfile.chatglm.cn`.
2. **Define the two players** with all fields (`id`, `name`, `shortName`,
   `rank`, `elo`, `surfaceElo?`, `photoUrl`, `color`, `form`, `country?`).
   `form` is most-recent-last: `["W","W","L","W"]`.
3. **Append a `TennisMatch`** to `MATCHES` with a unique `id` (e.g. `m4`).
   - `stats.h2h` is a string like `"5-2"` (wins-losses for player A).
   - `probA` / `probB` are seed values — they get **overwritten** by the
     prediction engine at request time (see `route.ts`).
   - `stats.ic` and `stats.confidence` are also recomputed — set sensible
     placeholders.
4. **Add H2H history** — populate the `h2hHistory: H2HMatch[]` array with past
   matchups (date, tournament, surface, winnerId, score).
5. **Add multi-bookmaker odds** — populate `allOdds: BookmakerOdd[]` with at
   least **5 bookmakers** (Bet365, Unibet, Bwin, Winamax, PMU…). Each entry
   needs `decimalA`, `decimalB`, and the derived `impliedProbA`,
   `impliedProbB`, `margin` (vig). The Odds API path computes these from live
   odds; the mock path uses your static values.
6. **If you added a new player**, also seed their Elo history in
   `src/lib/prediction/elo-history.ts` (`PLAYER_HISTORIES` record — 10 to 25
   entries spanning the last 12 months).
7. **Update the WebSocket service** if you want live updates: add the match to
   `SEED_MATCHES` in `mini-services/tennis-live/index.ts`.
8. **Add E2E coverage** if the match introduces new UI behavior.

Example skeleton:

```ts
{
  id: "m4",
  tournament: "Roland-Garros",
  round: "Quarts de finale",
  scheduledAt: "2026-06-02T13:00:00Z",
  playerA: { /* Player */ },
  playerB: { /* Player */ },
  probA: 60,           // recomputed at runtime
  probB: 40,
  stats: {
    form: "4V-2D",
    eloGap: 120,
    surface: "Terre battue",
    h2h: "3-1",
    ic: [52, 68],      // recomputed at runtime
    confidence: 0.6,   // recomputed at runtime
  },
  model: "Elo+Forme+Surface+H2H",
  modelUpdatedAt: new Date().toISOString(),
  allOdds: [ /* 5 BookmakerOdd entries */ ],
  h2hHistory: [ /* H2HMatch[] */ ],
}
```

---

## 9. Adding a new language

1. **Create a message catalog**: `src/messages/{locale}.json` (e.g.
   `src/messages/es.json`). Copy the structure of `src/messages/fr.json` and
   translate every value.
2. **Register the locale** in `src/i18n/routing.ts`:

```ts
export const routing = defineRouting({
  locales: ["fr", "en", "es"],   // ← add here
  defaultLocale: "fr",
  localePrefix: "never",
});
```

3. **Add an OG locale mapping** in `src/app/layout.tsx` (`OG_LOCALE` record,
   e.g. `es: "es_ES"`).
4. **Add the flag/label** to the language toggle in
   `src/components/language-toggle.tsx`.
5. **Update the `<html lang>` attribute** — already driven by `getLocale()`,
   no change needed.
6. **Add E2E coverage** in `tests/theme-language.spec.ts` (switch to the new
   locale and assert a translated string renders).

> next-intl is **cookie-based** (`NEXT_LOCALE` cookie, see
> `src/i18n/request.ts`). There is **no URL prefix** — the single visible route
> stays `/`.

---

## 10. Adding a new API route

Follow the pattern of `src/app/api/tennis/prematch/route.ts`:

```ts
import { NextResponse } from "next/server";

// In-memory cache (60s TTL) — prevents hammering upstream APIs
type CacheEntry = { data: Whatever; at: number };
const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

export async function GET() {
  const now = Date.now();

  // 1. Return cached data if fresh
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ data: cache.data, source: "cache" });
  }

  // 2. Try live API (if a key is configured)
  // 3. Fallback to mock data
  // 4. Always return a stable shape with `source: "cache" | "live" | "mock"`
  const data = /* ... */;
  cache = { data, at: now };
  return NextResponse.json({ data, source: "mock", updatedAt: new Date(now).toISOString() });
}
```

Conventions:

- **Cache for 60 s** in module scope (route handlers are long-lived in dev and
  warm serverless). Prevents upstream rate-limit issues.
- **Always provide a mock fallback** when an external key (`ODDS_API_KEY`,
  etc.) is missing — the app must run with zero env vars.
- **Return a `source` field** so the UI can show a "Démo" badge when serving
  mock data.
- Use `NextResponse.json()` (not `Response.json()`) for consistent header
  behavior.
- Mark expensive work with `next: { revalidate: 60 }` when calling `fetch()`
  upstream.

---

## 11. Adding a new component

1. **Compose shadcn/ui primitives** from `src/components/ui/`. Do not invent a
   new Button, Dialog, Select, Tabs, etc.
2. **Add i18n keys** to **both** `src/messages/fr.json` and `src/messages/en.json`.
3. **Mark `"use client"`** only if you need hooks, browser APIs, or event
   handlers. Otherwise keep it as a server component.
4. **Respect the provider tree** (see `src/app/layout.tsx`):

   ```
   ThemeProvider → NextIntlClientProvider → ConsentProvider
     → PHProvider → SentryErrorBoundary → {children}
   ```

   Anything that touches PostHog must be inside `PHProvider`. Anything that
   touches Sentry must be inside `SentryErrorBoundary`.
5. **Add an E2E test** in `tests/`. Use role-based selectors from
   `tests/page-objects.ts`.
6. **Lint must pass**: `bun run lint`.

---

## 12. Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description in imperative mood>

<optional body — what and why, not how>

<optional footer — BREAKING CHANGE: ... or refs #123>
```

Allowed `type` values:

| Type | When to use |
|---|---|
| `feat` | A new feature (minor bump) |
| `fix` | A bug fix (patch bump) |
| `docs` | Documentation only (README, CONTRIBUTING, comments) |
| `test` | Test-only changes (Playwright, k6) |
| `chore` | Tooling, deps, configs, CI tweaks |
| `refactor` | Code restructure with no behavior change |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace, semicolons (no logic change) |
| `ci` | CI/CD pipeline changes |

Examples:

```
feat(prediction): add clay-court surface weight to Elo blend
fix(consent): persist rejected state in cookie for 180 days
docs: add ARCHITECTURE.md and CONTRIBUTING.md
test(e2e): cover odds comparator value-bet highlight
chore(deps): bump next-intl to 4.3.4
perf(page): lazy-load MatchDetailDialog to cut initial JS by 200 KB
```

---

## 13. Pull requests

Before opening a PR:

1. **Lint clean**: `bun run lint`
2. **E2E green**: `bunx playwright test` (dev server on port 3000 must be
   running)
3. **Conventional commit** messages
4. **Both locales updated** if you touched UI strings
5. **No new env var without an `.env.example` entry** and a README mention

CI (`.github/workflows/`) will automatically run:

- `lint.yml` — `bun run lint`
- `build.yml` — `bun run build` + verify `.next/standalone/server.js` exists
- `e2e.yml` — builds standalone, starts `node .next/standalone/server.js`,
  runs the full Playwright suite in degraded mode (no `ODDS_API_KEY`, empty
  `NEXT_PUBLIC_POSTHOG_KEY`)
- `load-test.yml` — runs k6 `smoke` + `api_load` scenarios (PRs only;
  threshold failures are **informational**, not blocking)

All workflows use `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, and
`concurrency: cancel-in-progress` to avoid duplicate runs.

---

## 14. Deployment

The project builds to a **standalone** Next.js bundle:

```bash
bun run build
# → .next/standalone/server.js  (self-contained Node server)
# → .next/standalone/.next/static/  (copied by the build script)
# → .next/standalone/public/  (copied by the build script)
```

The `build` script in `package.json` already copies `static/` and `public/`
into the standalone output, so the resulting folder is fully self-contained.

### Production runtime

```bash
# Set every env var the app needs (see section 2)
export ODDS_API_KEY=...
export NEXT_PUBLIC_POSTHOG_KEY=...
export SENTRY_DSN=...
export NEXT_PUBLIC_SITE_URL=https://setpoint.example
# ... etc

NODE_ENV=production node .next/standalone/server.js
# listens on port 3000 by default (override with PORT if needed)
```

### Run alongside the WebSocket mini-service

The live-updates microservice **must run alongside** the main app on port
3001:

```bash
cd mini-services/tennis-live
bun install --frozen-lockfile
NODE_ENV=production bun index.ts   # port 3001, no --hot in prod
```

The Caddy gateway (see `Caddyfile`) forwards:

- Requests without `?XTransformPort` → `localhost:3000` (Next.js)
- Requests with `?XTransformPort=3001` → `localhost:3001` (WebSocket)

If the mini-service is down, the main app keeps working — it just shows static
prematch probabilities without the live overlay.

### Pre-go-live checklist

- [ ] Delete `src/app/api/sentry-test/route.ts` (temporary smoke-test endpoint)
- [ ] Replace demo player photos (`PHOTO_URLS` in `src/lib/tennis-data.ts`)
      with a licensed ATP/WTA photo CDN
- [ ] Replace mock `MATCHES` / `PLAYER_HISTORIES` with a real stats backend
- [ ] Wire the "Parier" CTA to your affiliation URL in
      `src/components/tennis/match-card.tsx` (`handleBetCta`)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the real canonical domain
- [ ] Configure all env vars (PostHog, Sentry, VAPID, Odds API)
- [ ] Run a final `bun run lint` + full Playwright + k6 `api_load`

---

**Questions?** Open an issue or check the existing worklog at `worklog.md` for
context on past decisions.
