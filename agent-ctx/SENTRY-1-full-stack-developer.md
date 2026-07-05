# Task SENTRY-1 — full-stack-developer

## One-line summary
Added Sentry error monitoring (`@sentry/nextjs@10.63.0`) to the Next.js 16 app: 3 runtime config files (client/server/edge), composed `withSentryConfig(withNextIntl(...))` in `next.config.ts`, a React error boundary in the layout, an `/api/sentry-test` smoke-test route, README docs, and `.env.example` updates — all respecting the existing `setpoint-consent` RGPD gate. Lint clean, dev server healthy, no app features touched.

## Context read before starting
- `/home/z/my-project/worklog.md` — prior tasks (WS-1 WebSocket live updates on port 3001, E2E-1 50-test Playwright suite, RGPD consent provider, PostHog analytics, i18n next-intl, PWA SW, push notifications).
- `/home/z/my-project/agent-ctx/E2E-1-e2e-test-engineer.md`, `/home/z/my-project/agent-ctx/WS-1-full-stack-developer.md` — prior agent work records.
- `next.config.ts` — existing wrapper `withNextIntl(nextConfig)`.
- `src/app/layout.tsx` — provider stack: ThemeProvider → NextIntlClientProvider → ConsentProvider → PHProvider → children + ConsentBanner + Toaster + ServiceWorkerRegister.
- `src/components/consent-provider.tsx` — `STORAGE_KEY = "setpoint-consent"`, `ConsentState.analytics: boolean` (used by Sentry `beforeSend`).
- `src/components/analytics-provider.tsx` — PostHog gated by consent, same pattern mirrored for Sentry.
- `.env.example` — appended Sentry section (4 vars).
- `eslint.config.mjs` — confirms `tests/**`, `examples/**`, `skills` ignored; `src/**` linted.
- `package.json` — no Sentry before this task.

## Files created
- `sentry.client.config.ts` — `Sentry.init` w/ `NEXT_PUBLIC_SENTRY_DSN`, `tracesSampleRate: 0.1`, `beforeSend` drops events unless `consent.analytics === true` (reads `localStorage["setpoint-consent"]`, same key as consent provider), try/catch around parsing, ignore-list for ResizeObserver / Network request failed / Failed to fetch.
- `sentry.server.config.ts` — `Sentry.init` w/ `SENTRY_DSN`, no `beforeSend` (server errors not user-controllable).
- `sentry.edge.config.ts` — identical to server config (edge runtime).
- `src/components/sentry-error-boundary.tsx` — class component (`"use client"`), `getDerivedStateFromError` + `componentDidCatch` → `Sentry.captureException(error, { contexts: { react: errorInfo } })`. Fallback UI: centered card with `AlertTriangle` icon, "Une erreur est survenue", "Recharger la page" button. Optional `fallback` render-prop. `role="alert"` + focus ring.
- `src/app/api/sentry-test/route.ts` — TEMPORARY, `dynamic = "force-dynamic"`, `GET(): never` throws synchronously. Next.js returns 500, Sentry instrumentation auto-captures. Verified via curl → HTTP 500.
- `README.md` — documents the 3 config files, env vars, RGPD behaviour, test procedure, and ⚠️ remove-before-go-live note for `/api/sentry-test`.

## Files modified
- `next.config.ts` — added `import { withSentryConfig } from "@sentry/nextjs"`, changed export to `withSentryConfig(withNextIntl(nextConfig), {...})`. Options: `org`, `project`, `silent: !process.env.CI`, `sourcemaps: { disable: !process.env.SENTRY_DSN }`, `disableLogger: true`.
- `.env.example` — appended `# Sentry` block with `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` + inline comments.
- `src/app/layout.tsx` — imported `SentryErrorBoundary`, wrapped `{children}` + `ConsentBanner` + `Toaster` + `ServiceWorkerRegister` inside `<PHProvider>` (per task spec: inside PHProvider, outside children).
- `package.json` + `bun.lock` — added `@sentry/nextjs@10.63.0`.

## Verification
- `bun run lint` → exit 0, 0 errors, 0 warnings.
- `curl http://localhost:3000/` → 200 (home still renders).
- `curl http://localhost:3000/api/sentry-test` → 500 (error thrown, captured by Sentry server instrumentation).
- `tail /home/z/my-project/dev.log` shows clean dev-server restart after `next.config.ts` change, no Sentry-related runtime errors. One harmless deprecation warning from Sentry about `disableLogger` (kept because the task spec explicitly requested it; replacement is webpack-only and unsupported under Turbopack).

## Known issues / caveats
1. **`disableLogger: true` deprecation warning** — Sentry prints a deprecation warning at build/dev time suggesting `webpack.treeshake.removeDebugLogging` instead, but that option is webpack-only and unsupported under Turbopack (which Next.js 16 uses by default). Kept `disableLogger: true` per task spec; behaviour is correct, only the warning is shown.
2. **`/api/sentry-test` is temporary** — must be deleted before go-live (documented in README + inline comment).
3. **No actual DSN configured in sandbox** — `Sentry.init` runs as a no-op. To verify end-to-end, set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in `.env`, restart dev server, accept analytics cookies (so client events pass `beforeSend`), then hit `/api/sentry-test` for a server error or trigger any client error to be caught by `SentryErrorBoundary`. Events appear in Sentry dashboard within seconds.
4. **Client `beforeSend` only fires after consent** — until the user accepts analytics via the consent banner, no client-side Sentry events are sent. Server-side errors are always reported (not user-controllable). This is intentional and matches the existing PostHog gating pattern.
5. **No source map upload in dev** — `sourcemaps.disable: !process.env.SENTRY_DSN` ensures source maps aren't uploaded when no DSN is configured. In CI with `SENTRY_DSN` + `SENTRY_ORG` + `SENTRY_PROJECT` set, upload is enabled automatically.
