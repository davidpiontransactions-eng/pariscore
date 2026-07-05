# BETSLIP-1 — Floating Bet Slip (DraftKings-style)

## Files created
- `src/hooks/use-bet-slip.ts` — singleton hook (BetSelection type, BET_SLIP_MAX=5, addToSlip/removeFromSlip/updateStake/clearSlip, totalStake/totalPayout/totalProfit, localStorage `setpoint-bet-slip`, cross-tab storage-event sync, deferred setState).
- `src/components/bet-slip.tsx` — floating panel at `fixed bottom-20 right-4 z-40` (above FeedbackWidget). Collapsed badge + expanded card with SlipRow sub-component. Place-bets calls `addBet` per selection then clearSlip + toast. Auto-expand on first add, auto-collapse on last remove.

## Files modified
- `src/components/bet-dialog.tsx` — added "Add to slip" outline emerald button alongside existing "Place bet" button. New `handleAddToSlip` builds a BetSelection + calls `addToSlip`; toasts on success / max-reached / already-in-slip. Extracted shared `computeOdd` helper.
- `src/components/tennis/match-card.tsx` — added 28px emerald "+" button overlay on each player's ProbabilityRing (PlayerBlock gains `onQuickAdd` + `quickAddLabel` optional props). New `handleQuickAdd("A"|"B")` in MatchCard builds a default-10€ selection.
- `src/app/layout.tsx` — mounted `<BetSlip />` between `<FeedbackWidget />` and `<Toaster />`.
- `src/messages/fr.json` + `src/messages/en.json` — added top-level `betSlip` namespace (17 keys each: title, empty, stake, odd, payout, total, potentialPayout, placeBets, clear, remove, added, placed, maxReached, addToSlip, quickAdd, collapse, expand, count, alreadyInSlip, vs).

## PostHog events
- `bet_slip_add` { match_id, bet_on, stake, source: "bet_dialog" | "ring_quick_add" } — consent-gated via useAnalytics.
- `bet_slip_remove` { match_id, bet_on }.
- `bet_slip_place` { count, total_stake, total_payout }.
- `bet_slip_clear` { source: "manual" | "place" }.

## Position / z-index
- `fixed bottom-20 right-4 z-40` → 80px from bottom, 16px from right, z-40 (same as FeedbackWidget which is at bottom-4 right-4 z-40 — visually below the slip). Below modal dialogs (z-50).

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- `npx tsc --noEmit` → 0 errors in created/modified files. Pre-existing tsc errors in page.tsx + match-card.tsx formatRelativeTime (Translator type) remain — out of scope (predates this task per STATS-1).
- Dev server (process 10722) healthy: `✓ Compiled in 332ms`, recent `GET / 200` + `GET /api/tennis/prematch 200` entries in dev.log. No errors.

## Critical constraints respected
- Did NOT start dev server (auto-running).
- Did NOT break existing BetDialog — "Place bet" still calls `addBet` directly + closes dialog.
- localStorage persistence under `setpoint-bet-slip`.
- react-hooks/set-state-in-effect respected: deferred setState via `Promise.resolve().then()` in both useBetSlip init effect and BetSlip auto-expand/collapse effect.
- Singleton pattern mirrors use-bankroll.ts / use-favorites.ts.
