# SetPoint — Technical Architecture

This document describes the architecture of **SetPoint**, a Tennis Prematch
predictions PWA built with Next.js 16. It is intended for maintainers and
contributors who need to understand how the pieces fit together before making
non-trivial changes.

> See also: [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contributor
> workflow, [`README.md`](./README.md) for a quick overview, and
> [`download/README-integration.md`](./download/README-integration.md) for the
> integration story of the MatchCard component.

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-level diagram](#2-high-level-diagram)
3. [Data flow](#3-data-flow)
4. [Prediction engine](#4-prediction-engine)
5. [Elo history](#5-elo-history)
6. [RGPD consent flow](#6-rgpd-consent-flow)
7. [PWA](#7-pwa)
8. [Push notifications](#8-push-notifications)
9. [WebSocket mini-service](#9-websocket-mini-service)
10. [Performance](#10-performance)
11. [Observability](#11-observability)
12. [Security](#12-security)

---

## 1. Overview

**SetPoint** is a Tennis Prematch predictions PWA. The app exposes a **single
visible route** (`/`, defined in `src/app/page.tsx`) that renders a dashboard
of upcoming tennis matches with model-derived win probabilities, multi-
bookmaker odds, and — when the WebSocket service is running — live score
updates.

Key properties:

- **Cookie-based i18n** via `next-intl` (`NEXT_LOCALE` cookie, no URL prefix).
  Locales: `fr` (default), `en`. See `src/i18n/routing.ts`.
- **RGPD-compliant analytics**: PostHog and Sentry are both **gated behind an
  explicit analytics consent**. No telemetry leaves the browser until the user
  accepts.
- **Graceful degradation**: the app runs with **zero environment variables**.
  Mock data is served when `ODDS_API_KEY` is absent; `track()` calls are no-op
  when `NEXT_PUBLIC_POSTHOG_KEY` is absent; Sentry is a no-op without a DSN.
- **PWA**: installable, offline-capable, with Web Push for value-bet alerts.
- **Single external port**: the Caddy gateway (`Caddyfile`) exposes one port
  and routes cross-port requests via the `?XTransformPort` query param.

---

## 2. High-level diagram

```
                         ┌─────────────────────────────────────────────┐
                         │                  Browser                     │
                         │                                             │
                         │  ┌───────────────────────────────────────┐  │
                         │  │  Next.js App (SSR + hydration)        │  │
                         │  │  ┌─────────────────────────────────┐  │  │
                         │  │  │ Provider tree (layout.tsx):     │  │  │
                         │  │  │  ThemeProvider                  │  │  │
                         │  │  │   └ NextIntlClientProvider      │  │  │
                         │  │  │      └ ConsentProvider          │  │  │
                         │  │  │         └ PHProvider            │  │  │
                         │  │  │            └ SentryErrorBoundary│  │  │
                         │  │  │               └ <page>           │  │  │
                         │  │  └─────────────────────────────────┘  │  │
                         │  │  SWR → /api/tennis/prematch (60s)     │  │
                         │  │  SWR → /api/tennis/elo-history        │  │
                         │  └────────────────┬──────────────────────┘  │
                         │                   │                         │
                         │  Service Worker (public/sw.js)             │
                         │  ├── cache-first: static assets             │
                         │  ├── network-first: /api/*                  │
                         │  ├── offline fallback → cached "/"          │
                         │  └── push event handler → showNotification  │
                         └──────────┬────────┴────────────┬────────────┘
                                    │ relative URLs       │ io("/?XTransformPort=3001")
                                    │                     │
                         ┌──────────▼─────────┐  ┌────────▼──────────────────┐
                         │   Caddy gateway    │  │  Caddy gateway (WS upgrade)│
                         │   (Caddyfile :81)  │  │  → localhost:3001          │
                         └──────────┬─────────┘  └────────┬──────────────────┘
                                    │                     │
                  ┌─────────────────┴───┐     ┌───────────▼────────────────┐
                  │  Next.js (port 3000)│     │ Mini-service tennis-live   │
                  │  - Route handlers   │     │ (port 3001, Bun+socket.io) │
                  │  - /api/tennis/*    │     │  - 5s simulation tick      │
                  │  - /api/push/*      │     │  - initial_state +         │
                  │  - SSR page         │     │    match_update events     │
                  └────────┬────────────┘     └────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────────────────┐
        │                  │                                  │
        ▼                  ▼                                  ▼
┌────────────────┐  ┌───────────────┐              ┌────────────────────┐
│  The Odds API  │  │   PostHog     │              │      Sentry        │
│ (external,     │  │ (analytics +  │              │ (error monitoring) │
│  optional)     │  │  A/B testing) │              │ client+server+edge │
│  odds only     │  │ consent-gated │              │ consent-gated      │
└────────────────┘  └───────────────┘              └────────────────────┘

        ┌──────────────────────────────────────────────────────────┐
        │  Image CDN: sfile.chatglm.cn  (player photos, demo only) │
        │  <link rel="preconnect"> in layout.tsx                    │
        └──────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────────────┐
        │  Web Push (VAPID)                                         │
        │  - Client subscribes via PushManager                      │
        │  - POST /api/push/subscribe stores in memory              │
        │  - web-push.sendNotification delivers via FCM/APNS/Mozilla│
        └──────────────────────────────────────────────────────────┘
```

---

## 3. Data flow

### 3.1 Initial page load

```
1. Browser GET /                    →  Caddy → Next.js (port 3000)
2. Next.js reads NEXT_LOCALE cookie →  getLocale() / getMessages()
3. Root layout SSR:
     ThemeProvider (next-themes, attribute="class")
       → NextIntlClientProvider (locale + messages)
         → ConsentProvider (reads localStorage "setpoint-consent"
                            + fallback cookie, 180-day TTL)
           → PHProvider (defers posthog.init until consent.analytics === true)
             → SentryErrorBoundary (wraps children, captureException on throw)
               → <page> (server component, renders MatchCards)
4. HTML streamed to browser → React hydration
5. SWR hooks fire client-side:
     usePrematchMatches() → GET /api/tennis/prematch  (refresh 60s)
     useEloHistory(matchId) → GET /api/tennis/elo-history
6. ServiceWorkerRegister (prod only) registers /sw.js
```

### 3.2 Prematch API request

```
Client SWR
   │
   ▼
GET /api/tennis/prematch  (src/app/api/tennis/prematch/route.ts)
   │
   ├─ 1. In-memory cache fresh (≤60s)?  ──► return { matches, source: "cache" }
   │
   ├─ 2. ODDS_API_KEY set?
   │     YES → fetch The Odds API (tennis_atp_singles, EU, decimal)
   │            on error → liveOdds = null (graceful)
   │     NO  → liveOdds = null
   │
   ├─ 3. For each match in MATCHES (src/lib/tennis-data.ts):
   │     build PlayerInputs (elo, surfaceElo, form, h2h)
   │     → predict() from src/lib/prediction/engine.ts
   │     → overwrite probA, probB, stats.ic, stats.confidence, stats.eloGap
   │     → merge allOdds (live or mock)
   │
   └─ 4. Cache + return { matches, source: "odds-api" | "mock", updatedAt }
```

> The engine output **always overrides** the seed `probA`/`probB` in
> `tennis-data.ts`. Bookmaker implied probabilities are **never** used as the
> displayed probability — only the Elo+Form+Surface+H2H model is.

### 3.3 WebSocket live updates

```
Client (use-live-matches.ts)
   │
   ▼
io("/?XTransformPort=3001")          ← relative URL, Caddy rewrites to :3001
   │
   ├── on connect → receive "initial_state" : LiveMatchState[]
   │                 (3 matches m1/m2/m3 seeded with prematch proba)
   │
   ├── every 5s   → receive "match_update" : LiveMatchState
   │                 (one match advanced by a simulated point)
   │
   └── emit "ping" → receive "pong" { t, echo }   (latency probe)
```

The hook merges live state into the SWR prematch data: when a match is live,
`liveProbA` overrides the static `probA` and the score is shown.

### 3.4 Consent-gated analytics

```
User clicks banner button
   │
   ▼
ConsentProvider.applyConsent(next)
   ├── localStorage.setItem("setpoint-consent", JSON.stringify(state))
   ├── document.cookie = "setpoint-consent=<code>|<ts>; max-age=180d; SameSite=Lax"
   └── window.dispatchEvent("consent-changed", state)
        │
        ├── PHProvider effect → if state.analytics: posthog.init() + opt_in
        │                       else:              posthog.opt_out_capturing()
        └── Sentry beforeSend (next event) → reads localStorage
                                              drops if analytics !== true
```

### 3.5 Sentry init (deferred)

Sentry is configured in three files at the project root:

- `sentry.client.config.ts` — browser SDK; `beforeSend` drops events unless
  `setpoint-consent` localStorage has `analytics: true`.
- `sentry.server.config.ts` — Node runtime (server components, route handlers).
  Server errors are **always** reported (not user-controllable).
- `sentry.edge.config.ts` — edge runtime (middleware).
- `next.config.ts` wraps `withSentryConfig` around the next-intl plugin.

If no DSN is configured, `Sentry.init` is a no-op.

---

## 4. Prediction engine

Location: `src/lib/prediction/engine.ts`.

### Model

Weighted blend of three signals, all converted to "probability that player A
wins":

| Signal | Weight | Source |
|---|---|---|
| **Elo** (surface-blended, logistic) | **70%** | `eloImpliedProb(blendedEloA, blendedEloB)` |
| **Form** (last 6 matches, exp decay) | **20%** | `formScore()` → logistic on difference |
| **H2H** (direct matchup win rate) | **10%** | `h2hScore(playerA.h2h)` |

### Surface blend

`blendedElo = 0.55 × surfaceElo + 0.45 × overallElo`

The 55% surface weight means a player's performance on the upcoming surface
dominates, while overall Elo still contributes. If `surfaceElo` is absent it
defaults to `elo` (no surface data → neutral blend).

### Form score

Exponential decay over the last 6 matches (`FORM_WINDOW = 6`):

```
weight_i = 0.85 ^ (window.length - 1 - i)   # most recent = highest weight
formScore = Σ(weight_i × outcome_i) / Σ(weight_i)   # outcome ∈ {0,1}
```

Then converted to a probability via `pForm = 1 / (1 + exp(-(formA - formB) × 4))`
— the `×4` amplifies small form differences.

### Elo logistic

Standard tennis Elo formula:

```
P(A beats B) = 1 / (1 + 10^((eloB - eloA) / 400))
```

### Confidence interval (95%)

Parametric bootstrap with **1000 resamples**:

1. Add Gaussian noise to each component:
   - `σ_Elo = 0.04`  (~4 percentage points)
   - `σ_Form = 0.08`
   - `σ_H2H = 0.10`
2. Recompute `pA` for each sample (same weighted blend).
3. Take the **2.5th** and **97.5th** percentiles → `ic = [low, high]` (in %).

Gaussian noise is generated via Box-Muller transform (see `gaussian()`).

### Confidence score

```
icWidth = icHigh - icLow
confidence = clamp(1 - icWidth / 40, 0, 1)
```

A 40-point IC width maps to zero confidence; a 0-point IC width maps to one.

### Output

```ts
type PredictionResult = {
  probA: number;       // 0-100 (playerA = favorite)
  probB: number;       // 100 - probA
  ic: [number, number];// 95% CI for probA
  confidence: number;  // 0-1
  eloGap: number;      // blendedEloA - blendedEloB (rounded)
  model: "Elo+Forme+Surface+H2H";
  weights: { elo: 0.70, surface: 0.55, form: 0.20, h2h: 0.10 };
};
```

---

## 5. Elo history

Location: `src/lib/prediction/elo-history.ts`.

The app charts each player's Elo progression over the **last 12 months**
(10–25 matches per player). Since we only have the **current** Elo (not the
historical one), the module **reverse-computes** the past values:

### Algorithm (reverse Elo)

For each past match (walking backward from today):

```
known:  currentElo (after match), opponentElo, result (W/L)
solve:  preMatchElo (before match)

Elo update rule (forward):
  expected = 1 / (1 + 10^((opponentElo - preMatchElo) / 400))
  delta    = K × (result === "W" ? 1 - expected : -expected)
  currentElo = preMatchElo + delta

Reverse:
  preMatchElo = currentElo - delta
```

Because `delta` depends on `preMatchElo` (which we don't know yet), this is a
**fixed-point iteration**. We run **3 iterations** starting from
`preMatchElo = currentElo`, which converges fast enough for charting.

```
iter 0: preMatchElo = currentElo
iter 1..3:
  expected = 1 / (1 + 10^((opp - preMatchElo) / 400))
  delta    = K × (W ? 1 - expected : -expected)      # K = 32
  preMatchElo = currentElo - delta
```

The resulting `preMatchElo` becomes the "currentElo" for the next (older)
match. Points are unshifted into chronological order and today's Elo is
appended as the final point.

### Production replacement

The `PLAYER_HISTORIES` record is a synthetic seed. In production, replace
`computeEloHistory` with a `fetch()` to your stats backend returning actual
historical Elo points.

---

## 6. RGPD consent flow

The consent system is the **single source of truth** for whether any
non-essential cookie/script may fire.

### Components

| File | Role |
|---|---|
| `src/components/consent-provider.tsx` | React context holding consent state. Reads/writes `localStorage["setpoint-consent"]` + a 180-day `setpoint-consent` cookie. Dispatches a `consent-changed` CustomEvent on every change. |
| `src/components/consent-banner.tsx` | Bottom banner with **3 levels**: accept all, analytics-only, reject all. |
| `src/components/privacy-dialog.tsx` | 6-section privacy policy modal (identity, purposes, recipients, retention, rights, cookies). |

### Consent state

```ts
type ConsentState = {
  status: "necessary" | "all" | "analytics-only" | "rejected" | "pending";
  analytics: boolean;
  marketing: boolean;
  necessary: true;        // always true
  grantedAt: string | null;
};
```

### Storage format

- **localStorage**: full JSON state (primary).
- **Cookie**: compact serialized form (`all|<ts>`, `a|<ts>`, `n|<ts>`),
  SameSite=Lax, 180-day TTL. Used as a fallback when localStorage is disabled
  and read by Sentry's `beforeSend`.

### Gating

- **PostHog** (`src/components/analytics-provider.tsx`): `posthog.init()` is
  **not called** until `state.analytics === true`. If the user later rejects,
  `posthog.opt_out_capturing()` is called.
- **Sentry client** (`sentry.client.config.ts`): `beforeSend` reads
  `localStorage["setpoint-consent"]`, parses it, and **returns null** (drops
  the event) if `analytics` is not true.
- **Sentry server**: always reports (server errors are not user-controllable).

The precautionary principle applies: **before** the user has decided
(`status === "pending"`), no analytics fires.

---

## 7. PWA

### Manifest

`public/manifest.json` — declares the app as installable, with icons
(`public/icon-192.png`, `public/icon-512.png`), theme color (`#10b981`),
and standalone display mode.

### Service worker

`public/sw.js` — registered by `src/components/sw-register.tsx` **in
production only** (`process.env.NODE_ENV !== "production"` guard).

| Request type | Strategy |
|---|---|
| Static assets (same-origin GET) | **Cache-first** — serve from cache, fall back to network, cache the response. |
| `/api/*` (same-origin GET) | **Network-first** — try network, cache the response on success, fall back to cache on failure. |
| Navigation (offline) | Serve cached `"/"` if network fails. |
| Cross-origin / non-GET | Bypassed (no caching). |

Cache versioning: `setpoint-static-v4` / `setpoint-api-v4`. Old caches are
deleted on `activate`. The page can trigger `skipWaiting` via
`postMessage("SKIP_WAITING")`.

### Registration

`src/components/sw-register.tsx`:

- No-op during SSR.
- No-op in development (avoids caching dev assets).
- Calls `navigator.serviceWorker.register("/sw.js", { scope: "/" })`.

---

## 8. Push notifications

Web Push uses **VAPID** (Voluntary Application Server Identification). Keys are
generated with `bunx web-push generate-vapid-keys`.

### Keys

| Env var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | Passed to `pushManager.subscribe({ applicationServerKey })` |
| `VAPID_PRIVATE_KEY` | **server only** | Used by `web-push` to sign push messages |
| `VAPID_SUBJECT` | server | `mailto:` or `https:` URL identifying the sender |

### Flow

```
1. User clicks push toggle (src/components/push-toggle.tsx)
2. Notification.requestPermission() → "granted"
3. navigator.serviceWorker.ready → reg.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: <VAPID public key as Uint8Array>
   })
4. POST /api/push/subscribe  (src/app/api/push/subscribe/route.ts)
     → subscriptionsRef.set(sub)   (src/lib/push/store.ts, in-memory Map)
5. Server sends push:
     web-push.sendNotification(sub, payload, { vapidDetails })
     → FCM (Chrome), APNS (Safari), Mozilla autopush (Firefox)
     → browser receives "push" event in /sw.js
     → self.registration.showNotification(title, options)
```

### Service worker push handler

`public/sw.js` listens for `push` events, parses the JSON payload
(`{ matchId, playerA, playerB, probA, bookmaker, decimalA, impliedProbA }`),
and shows a notification titled **"Value bet détecté"** with two actions:
"Voir le match" and "Ignorer". Clicking focuses an existing window or opens a
new one to `"/"`.

### Subscription store

`src/lib/push/store.ts` is an **in-memory `Map`** keyed by subscription
endpoint. Sufficient for a single-process demo. In production, replace with a
Prisma `PushSubscription` table (see the file's docstring).

> **Note**: the client hook `src/hooks/use-push-notifications.ts` also calls
> `POST /api/push/test` to trigger a test alert. Make sure that route exists
> (or wire it to `webpush.sendNotification`) before relying on the test-alert
> feature.

---

## 9. WebSocket mini-service

Location: `mini-services/tennis-live/` — an **independent Bun project** with
its own `package.json` and `bun.lock`.

### Runtime

- **Bun + socket.io** (not Next.js).
- **Hardcoded port 3001** (per the gateway convention — never use `PORT` env).
- Path `/` (Caddy uses this for forwarding).
- `bun --hot index.ts` for dev (auto-restart on file change).
- CORS: allow all origins.
- `pingTimeout: 60s`, `pingInterval: 25s`.

### Simulation

The service holds an in-memory state of 3 matches (`m1`, `m2`, `m3`) seeded
with the prematch probabilities from `src/lib/tennis-data.ts` (84 / 71 / 58
for player A).

Every **5 seconds**, **one** match (round-robin) is advanced by a single
simulated point:

1. **Point outcome**: weighted by `liveProbA` + serve bonus.
2. **Game win**: 4 points with a 2-point lead (deuce/advantage).
3. **Set win**: 6 games with a 2-game lead, or 7 games.
4. **Match win**: best-of-3 (first to 2 sets). On match end, the match
   auto-restarts so the demo keeps producing updates.
5. **Live probability**: recomputed via small random walk + drift toward the
   point winner, clamped to `[2, 98]`.

### Events

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `initial_state` | `LiveMatchState[]` (sent once on connect) |
| Server → Client | `match_update` | `LiveMatchState` (broadcast every ~5s) |
| Client → Server | `subscribe_match` | `{ matchId: string }` (logged only, future use) |
| Client → Server | `ping` | any → `pong` `{ t, echo }` |

### Gateway

The frontend connects with **`io("/?XTransformPort=3001")`** — a relative
URL. The Caddy gateway (`Caddyfile`) detects the `XTransformPort` query param
and reverse-proxies to `localhost:3001`, upgrading the connection to
WebSocket. **Never** use `io("http://localhost:3001")` — it would bypass the
gateway and fail in the sandbox.

### Client hook

`src/hooks/use-live-matches.ts`:

- Connects on mount, disconnects on unmount.
- Auto-reconnects with exponential backoff (socket.io default).
- Merges live state into the SWR prematch data: when a match is live,
  `liveProbA`/`liveProbB` override the static probabilities and the live score
  is rendered.
- 5-second stale guard: if no `match_update` arrives within 5s of the last
  one, the match is marked as not-live.

---

## 10. Performance

| Technique | Where | Why |
|---|---|---|
| **Lazy-load MatchDetailDialog** | `src/app/page.tsx` via `next/dynamic` | Recharts (~200 KB) is only loaded when the dialog opens. Cuts initial JS significantly. |
| **Preconnect to image CDN** | `src/app/layout.tsx` `<link rel="preconnect" href="https://sfile.chatglm.cn">` | Saves ~100 ms on LCP for player photos. |
| **DNS-prefetch PostHog** | `src/app/layout.tsx` | Faster PostHog init when consent is granted. |
| **`fetchpriority="high"`** on above-the-fold images | `src/components/tennis/match-card.tsx` | Prioritizes LCP image fetch. |
| **SWR 60s cache** | `src/hooks/use-prematch-matches.ts` | Avoids hammering `/api/tennis/prematch`; the route itself caches 60s server-side too. |
| **Server-side route cache** | `src/app/api/tennis/prematch/route.ts` | Module-level `cache` Map, 60s TTL, dedups concurrent fetches via an `inflight` promise. |
| **`output: "standalone"`** | `next.config.ts` + `package.json` build script | Self-contained `.next/standalone/` for minimal prod deployments. |
| **No SW in dev** | `src/components/sw-register.tsx` | Avoids stale-cache headaches during development. |

---

## 11. Observability

| Concern | Tool | Where |
|---|---|---|
| **Client errors** | Sentry browser SDK | `sentry.client.config.ts`, captured by `SentryErrorBoundary` |
| **Server errors** | Sentry Node SDK | `sentry.server.config.ts` (route handlers, server components) |
| **Edge errors** | Sentry edge SDK | `sentry.edge.config.ts` |
| **User feedback** | Sentry feedback + custom widget | `src/components/feedback-widget.tsx` (bug/data/ux/other → `captureMessage` with tags) |
| **Analytics** | PostHog | `src/components/analytics-provider.tsx` (page_view, match_card_view, bet_cta_click, experiment_assigned, …) |
| **A/B testing** | PostHog feature flag | Experiment `tennis-prematch-chips-layout` (variants `chips_visible` / `chips_collapsed`) |
| **Load** | k6 | `tests/load/script.js` (4 scenarios) |
| **E2E** | Playwright | `tests/*.spec.ts` (~51 tests, 8 files) |

### A/B test

- **Experiment key**: `tennis-prematch-chips-layout`
- **Variants**: `chips_visible` (control, 50%) / `chips_collapsed` (treatment, 50%)
- **Primary metric**: `bet_cta_click`
- **Secondary**: `detail_open`, `match_card_view`, `filter_click`
- Without PostHog configured, the variant defaults to `chips_visible`.

---

## 12. Security

| Concern | Mitigation |
|---|---|
| **Direct port access from client** | All client `fetch` / `io()` calls use **relative URLs**. The Caddy gateway rewrites `?XTransformPort=N` to `localhost:N`. Direct `http://localhost:NNNN` is forbidden in client code. |
| **VAPID private key exposure** | `VAPID_PRIVATE_KEY` is **server-only** (no `NEXT_PUBLIC_` prefix). It is imported only in route handlers, never in client components. |
| **Analytics without consent** | PostHog `init` is deferred until `consent.analytics === true`. Sentry client `beforeSend` drops events unless consent granted. PostHog also sets `respect_dnt: true` and `autocapture: false`. |
| **Consent tampering** | Consent is stored both in `localStorage` (full state) and in a signed cookie (compact form). The cookie survives a localStorage clear, so a refresh does not silently re-enable analytics. |
| **XSS in i18n** | All user-facing strings come from `src/messages/*.json` (trusted, bundled at build time). No user-supplied strings are interpolated into the DOM without escaping. |
| **Push subscription spam** | The in-memory store is keyed by subscription endpoint; `subscriptionsRef.set` is idempotent. The store is per-process — replace with a DB table for multi-instance prod. |
| **Service worker scope** | Registered with `scope: "/"`. Cross-origin requests are explicitly bypassed in the fetch handler (no third-party caching). |
| **Sentry source maps** | `SENTRY_ORG` / `SENTRY_PROJECT` are only used in CI for source-map upload; not required at runtime. |

---

*This document reflects the state of the codebase at the time of writing. For
the latest decisions and rationale, see [`worklog.md`](./worklog.md).*
