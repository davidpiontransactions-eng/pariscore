# DIGEST-1 — full-stack-developer

## Task
Add **daily digest notifications** to the SetPoint Tennis Prematch app — group all value bets detected over 24h into a single push + email notification instead of per-value-bet alerts. Opt-in (default OFF), RGPD-gated, localStorage-backed.

## Status: DONE

## Artifacts

### Created
- `src/hooks/use-digest-scheduler.ts` — `'use client'` hook + pure helpers (`isDigestEnabled`, `setDigestEnabled`, `readDigestLastSent`) + `DigestBet` type. localStorage keys: `setpoint-digest-enabled` + `setpoint-digest-last-sent`. Scheduler effect runs on mount (3s delay) + every 30 min: checks consent → digest-enabled → 24h elapsed → ≥1 channel subscribed → ≥1 value bet, then POSTs `{ bets: top5 }` to `/api/push/digest` (if push subscribed) + `/api/email/digest` (if email subscribed). `setDigestEnabled` dispatches a `setpoint-digest-change` CustomEvent for same-tab sync; hook also listens to native `storage` for cross-tab sync. All latest values stored in refs so the mount-only effect doesn't re-subscribe.
- `src/app/api/push/digest/route.ts` (POST) — validates `{ bets: DigestBet[] }` body (400 on invalid). Title `SetPoint — N value bets aujourd'hui` (sing/plural). Body: top 3 bets, one line each (`• {player} @ {bookmaker} ({decimalA})`). Graceful degradation: no subscribers → `mode:"no-subscribers"`; VAPID env vars unset → console log + `mode:"console"`; otherwise web-push sendNotification per sub → `mode:"web-push"`. Imports `getSubscriptions` from `@/app/api/push/subscribe/route` (existing pattern).
- `src/app/api/email/digest/route.ts` (POST) — same body validation. Builds FR subject + plain-text + HTML email (5-column table: #/Joueur/Modèle/Bookmaker/Edge, top 5 bets, emerald edge column, HTML-escaped). Uses existing `subscribersRef.snapshot()` + `sendEmail()` (which does SMTP→console graceful degradation). Returns `{ mode: "smtp"|"console"|"no-subscribers", sent, failed, total, subject }`.

### Modified
- `src/components/value-bet-scanner-indicator.tsx` — wrapped bell in flex container; added a calendar toggle button (lucide `Calendar`/`CalendarCheck`) next to it. Mounts `useDigestScheduler()` here so the scheduler runs on every page load. Toggle click calls `setDigestEnabled(!digestOn)` — no local setState (the hook's `enabled` state drives the re-render via the custom event). Tooltip shows `t("digest.title")` + `t("digest.tooltip")`/`t("digest.tooltipOn")` + last-sent timestamp. `mounted` gate prevents hydration mismatch.
- `src/hooks/use-value-bet-scanner.ts` — added `import { isDigestEnabled } from "@/hooks/use-digest-scheduler";`. Early-return guard at the top of `scan()`: if digest is enabled, updates `lastScanAt` and returns WITHOUT detecting/alerting/deduping. This means individual alerts are FULLY preserved when digest is OFF (default), and when digest is ON the scanner doesn't mark bets as alerted — so disabling digest later doesn't silently drop any alerts.
- `src/messages/fr.json` + `src/messages/en.json` — new `digest` namespace (7 keys: tooltip, tooltipOn, enable, disable, title, body, noBets). Placed right after `scanner` namespace. FR verbatim from task spec; EN equivalents.

## Lint: 0 errors, 0 warnings

## Verification (curl against running dev server :3000)
- `POST /api/push/digest` (3 bets) → 200 `{"success":true,"mode":"no-subscribers","title":"SetPoint — 3 value bets aujourd'hui","body":"• Aryna Sabalenka @ PMU (1.15)\n• Carlos Alcaraz @ PMU (1.36)\n• Jannik Sinner @ PMU (1.68)"}`
- `POST /api/push/digest` (`{"bets":[]}`) → 200 `{"title":"SetPoint — 0 value bet aujourd'hui","body":"Aucun value bet aujourd'hui"}`
- `POST /api/email/digest` (2 bets, 1 subscriber) → 200 `{"success":true,"mode":"console","sent":1,"failed":0,"total":1,"subject":"🎾 SetPoint — 2 value bets aujourd'hui"}` (dev.log shows the `[email:console]` formatted block — graceful SMTP degradation confirmed)
- `POST /api/email/digest` (`{"bets":[]}`) → 200 with `Aucun value bet aujourd'hui.` body
- `POST /api/email/digest` (`{"invalid":true}`) → 400 `{"error":"Invalid digest payload"}`
- `GET /` → 200 (page compiles cleanly with the modified indicator + new hook)

## How to test (manual)
1. Open the app — the header now shows a small calendar icon next to the scanner bell (between the email toggle and the Bankroll button).
2. Hover the calendar → tooltip reads "Digest quotidien / Activer le digest quotidien".
3. Click the calendar → icon turns emerald (CalendarCheck), tooltip reads "Digest quotidien activé". localStorage `setpoint-digest-enabled` is now `"true"`.
4. With digest ON: the scanner bell no longer pulses / increments when new value bets appear (scan is suppressed). Instead, after 24h (or immediately if `setpoint-digest-last-sent` is cleared), the scheduler fires a single push (if push-subscribed) + email (if email-subscribed) with the top 5 value bets.
5. To force-fire the digest for testing: in the browser console, run `localStorage.removeItem("setpoint-digest-last-sent")` then wait 30 min (or refresh — the 3s mount check will fire). For instant feedback, also subscribe to push/email first and grant analytics consent in the RGPD banner.
6. Click the calendar again → icon reverts to muted Calendar, individual alerts resume on the next 5-min scan.

## Critical integration notes for the main agent
1. Digest is OPT-IN (default OFF). Existing individual-alert behavior is 100% unchanged when OFF. When ON, the scanner short-circuits (just updates `lastScanAt`) and the digest scheduler takes over.
2. RGPD gating is STRICTER than the existing scanner: the scheduler requires `useHasAnalyticsConsent() === true` before firing. The existing scanner fires regardless of consent. This is intentional — the digest is treated as a marketing-ish notification.
3. The push digest route imports `getSubscriptions` from `@/app/api/push/subscribe/route` (the in-memory array, NOT `src/lib/push/store.ts`'s unused `subscriptionsRef`). If you migrate push storage, update both routes.
4. Push sending needs `VAPID_SUBJECT` + `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` env vars. Without them, the route logs to console (graceful degradation, same as email transport).
5. The scheduler is mounted inside `ValueBetScannerIndicator` (header) — runs on every page load. SWR dedupes the prematch fetch across scanner + scheduler + page.
6. localStorage keys: `setpoint-digest-enabled` ("true"/"false") + `setpoint-digest-last-sent` (ms timestamp string). Same-tab sync via `setpoint-digest-change` CustomEvent; cross-tab sync via native `storage` event.
7. The `digest` namespace's `body`/`noBets` keys are defined but currently unused in the UI (notification text is generated server-side in French). Available for future client-side toast confirmation or localized preview. The `tooltip`/`tooltipOn`/`enable`/`disable`/`title` keys ARE used in the calendar toggle.
8. No new dependencies installed. web-push (v3.6.7) and nodemailer (v9.0.3) were already in package.json. The push digest route dynamic-imports `web-push` only when VAPID is configured (Node-only module, never bundled for the client).
