# EMAIL-1 — full-stack-developer

## Task
Add email notifications for value bet alerts to the SetPoint (Tennis Prematch) Next.js 16 app — as an alternative channel alongside the existing web-push (VAPID) notifications.

## Status: DONE

## Artifacts

### Created
- `src/lib/email/store.ts` — in-memory `Map<string, EmailSubscriber>` keyed by normalized email. Exports `subscribersRef` (add/has/delete/snapshot/size), `isValidEmail` (regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), `normalizeEmail` (trim + lowercase). Server-only. Mirrors `src/lib/push/store.ts` pattern.
- `src/lib/email/send.ts` — graceful-degradation email transport. `getTransporter()` lazily builds a Nodemailer transporter from `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (cached). When SMTP is unset, `sendEmail()` logs a formatted `[email:console]` block to the server console instead of throwing. `buildValueBetEmail()` produces FR subject + text + HTML for a value-bet alert (computes edge = probA − impliedProbA). Server-only — never imported by client code.
- `src/hooks/use-email-alerts.ts` — `'use client'` hook. localStorage key `setpoint-email-alerts`. Returns `{ mounted, email, subscribed, state, subscribe, unsubscribe, sendTestAlert }`. Hydration via `Promise.resolve().then(...)` (deferred setState — satisfies react-hooks/set-state-in-effect). Cross-tab `storage` event sync. Tracks `email_subscribed` / `email_unsubscribed` / `email_test_alert_sent` in PostHog via useAnalytics. All fetches use relative URLs.
- `src/app/api/email/subscribe/route.ts` (POST) — validates, normalizes, dedupes (idempotent), stores. 201 `{ success, count }` / 400 on invalid.
- `src/app/api/email/unsubscribe/route.ts` (POST) — removes from store. 200 `{ success, count }` (idempotent).
- `src/app/api/email/test/route.ts` (POST) — accepts `{ matchId, playerA, playerB, probA, bookmaker, decimalA, impliedProbA }` (typed guard). Sends to all subscribers via `sendEmail()`. 200 `{ success, sent, failed, total, mode }` where mode = `"smtp"` | `"console"`.
- `src/components/email-toggle.tsx` — header toggle. Mail/MailCheck icons (lucide). Not subscribed → Popover with email Input + "Activer" button (client-side validation + error text). Subscribed → emerald MailCheck + dot badge, tooltip "Alertes email activées sur {email}", click unsubscribes directly. Returns null until mounted (hydration safety). Loader2 spinner during async ops.

### Modified
- `src/app/page.tsx` — `<EmailToggle />` added to header right after `<PushToggle />`.
- `src/components/tennis/match-card.tsx` — added Mail/Loader2 imports, Tooltip components, useEmailAlerts hook. New `handleEmailTestAlert()` computes vig-inclusive impliedProbA from `match.odds` (`(1/decimalA) / (1/decimalA + 1/decimalB) * 100`) and calls `sendTestAlert()`. New icon button in footer CTA row (between Analyse and Parier), only renders when `match.odds` exists, tooltip = tEmail("testAlert"), spinner while sending.
- `src/messages/fr.json` + `src/messages/en.json` — new `email` namespace (tooltip, subscribed with {email}, subscribe, unsubscribe, placeholder, invalid, testAlert).
- `.env.example` — appended SMTP section (SMTP_HOST, SMTP_PORT=587, SMTP_USER, SMTP_PASS, SMTP_FROM=noreply@setpoint.example) with server-only comment.
- `package.json` — added `nodemailer@9.0.3` (dep) + `@types/nodemailer@8.0.1` (dev dep).

## Lint: 0 errors, 0 warnings

## Verification (curl against running dev server :3000)
- `POST /api/email/subscribe` valid → 201 `{"success":true,"count":1}`
- `POST /api/email/subscribe` invalid → 400 `{"error":"Invalid email format"}`
- `POST /api/email/test` → 200 `{"success":true,"sent":1,"failed":0,"total":1,"mode":"console"}` (dev.log shows the `[email:console]` formatted body — graceful degradation confirmed)
- `POST /api/email/unsubscribe` → 200 `{"success":true,"count":0}`
- `GET /` → 200 (header + match-card compile cleanly)

## How to test
1. Header: click the Mail icon (next to the bell) → Popover opens → type an email → "Activer" → icon turns emerald with a dot badge; tooltip shows the subscribed email. Click again to unsubscribe.
2. Match card: each card with bookmaker odds now has a small Mail icon button in the footer (between "Analyse complète" and "Parier"). Click it → fires `POST /api/email/test` for that match's value bet. With no SMTP env, the email body is logged to the server console (dev.log) — verify with `tail -f dev.log | grep email:console`. With SMTP configured, a real email is sent to every subscriber.
3. PostHog: `email_subscribed`, `email_unsubscribed`, `email_test_alert_sent` events fire (gated by consent — grant analytics in the consent banner first).

## Critical integration notes for the main agent
1. Email channel is FULLY ADDITIVE — no existing push notification code was modified. The two channels coexist independently (push uses VAPID/web-push + service worker; email uses Nodemailer + in-memory store).
2. SMTP credentials are SERVER-ONLY (`process.env.SMTP_*`, no NEXT_PUBLIC_ prefix). The only client↔server contract is the relative `/api/email/*` URLs. `src/lib/email/send.ts` is imported exclusively by the API route handler.
3. Graceful degradation: with `SMTP_HOST` unset, `/api/email/test` returns 200 with `mode: "console"` and logs the formatted email to the server console. This is the current dev state — no SMTP server is configured in this sandbox. Set the SMTP_* env vars to send real email.
4. The in-memory `subscribersRef` Map resets on server restart (same limitation as the existing push store). Replace with a Prisma `EmailSubscription` table for production.
5. `useEmailAlerts` returns null until `mounted === true` (same hydration-safety pattern as PushToggle) — the SSR HTML does NOT contain the toggle, it renders client-side only. This is intentional and matches the existing push toggle behavior.
6. The match-card email test button computes `impliedProbA` as the VIG-INCLUSIVE implied probability (`(1/decimalA) / (1/decimalA + 1/decimalB) * 100`), which differs from the `allOdds[].impliedProbA` field in tennis-data.ts (which is vig-REMOVED). This is intentional for the test alert — we want to show what the bookmaker's raw odds imply so the "edge" comparison against the model is meaningful to the user.
7. PostHog tracking is consent-gated: `useAnalytics.track()` is a no-op when analytics consent hasn't been granted or when `NEXT_PUBLIC_POSTHOG_KEY` is unset. This is the existing behavior, unchanged.
