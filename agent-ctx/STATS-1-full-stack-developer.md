# STATS-1 — Advanced bankroll statistics

**Agent:** full-stack-developer
**Task ID:** STATS-1
**Date:** 2025
**Status:** ✅ Complete (lint 0 errors, dev server compiles clean)

## Objective

Add advanced bankroll statistics to the SetPoint (Tennis Prematch) Next.js 16 app:
breakdowns by bookmaker / player / month, surfaced in a new 4th "Stats" tab inside
`BankrollDialog`, with backward-compatible optional `surface`/`tournament` fields on
`Bet` captured from the match data at bet-placement time.

## Prior context read

Consulted worklog.md and the prior agent-ctx records (WS-1, ELO-1/2, V8 bankroll/email,
ABTEST-1) to understand the existing bankroll architecture:
- `src/hooks/use-bankroll.ts` — singleton store over localStorage key `setpoint-bankroll`,
  `Bet` type, `useBankroll()` returns `{ state, bets, stats, setInitial, addBet, settleBet, deleteBet, clearAll }`.
- `src/components/bankroll-dialog.tsx` — 3 tabs (overview/history/settings), max-w-2xl dialog.
- `src/components/bet-dialog.tsx` — player selector + stake + potential payout; `match` prop was
  a simplified subset (no tournament/surface).
- `src/lib/tennis-data.ts` — `TennisMatch` has top-level `tournament` and nested `stats.surface`.
- Recharts 2.15.4 already installed and used in `match-detail-dialog.tsx`.

## Files modified (5)

### 1. `src/hooks/use-bankroll.ts`
- Extended `Bet` type with **optional** `surface?: string` and `tournament?: string`
  (backward compatible — old localStorage bets parse fine; fields default to `undefined`).
- Added exported types `GroupStats` and `AdvancedStats`.
- Added module-scope pure helpers:
  - `monthKey(iso)` → `"YYYY-MM"` (UTC) or `"—"` on invalid input.
  - `computeGroupStats(bets, getKey)` → groups bets, counts bets/pending/won/lost,
    sums staked + profit over settled bets only, derives `roi` and `winRate`, sorts by
    **profit descending** (stable tiebreak on key). Pending bets contribute to
    `bets`/`pending` only.
- Added `advancedStats` computed value returned from `useBankroll()`:
  - `byBookmaker` — key = `bet.bookmaker?.trim() || "—"`
  - `byPlayer` — key = `bet.betOnName`
  - `byMonth` — key = `monthKey(bet.placedAt)`
- `addBet` signature shape unchanged (`Omit<Bet, "id"|"placedAt"|"status">`); the new
  optional fields propagate automatically.

### 2. `src/components/bet-dialog.tsx`
- Extended `match` prop type with optional `tournament?: string` / `surface?: string`.
- `handlePlaceBet` now passes `surface: match.surface` and `tournament: match.tournament`
  to `addBet`.

### 3. `src/app/page.tsx` (1 line)
- `<BetDialog match={betMatch ? { ...betMatch, surface: betMatch.stats.surface } : null} />`
  — spreads the full TennisMatch and lifts `stats.surface` to a top-level `surface` so it
  matches BetDialog's prop shape. No other page logic touched.

### 4. `src/components/bankroll-dialog.tsx`
- New imports: shadcn `Table*`, Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`,
  `CartesianGrid`, `Tooltip as RTooltip`, `ResponsiveContainer`, `Cell`, `ReferenceLine`),
  lucide `BarChart3` + `Inbox`, `useLocale`, `type GroupStats`.
- Destructured `advancedStats` from `useBankroll()`.
- `TabsList` → `grid-cols-4`, added 4th `<TabsTrigger value="stats">` (BarChart3 icon).
- New `<TabsContent value="stats">` rendering `<AdvancedStatsView … />`.
- New components appended after `StatCard`:
  - `AdvancedStatsView` — empty-state card when `!hasSettled`; else 3 sections.
  - `StatsSection({ title, nameKey, groups })` — semantic shadcn Table, 5 columns
    (name | Bets | Win rate | Profit | ROI), `max-h-72 overflow-y-auto` with custom thin
    scrollbar, sticky header, profit/ROI colored emerald/rose/muted, "—" when no settled.
  - `MonthlyProfitChart({ groups })` — Recharts BarChart (h-56), months sorted
    chronologically, per-bar `<Cell>` colored by sign, `ReferenceLine y={0}`, custom tooltip.
  - `MonthTooltip` — compact card showing month/profit/ROI/bets, colored by sign.
  - `formatMonthLabel(key, locale)` — `"YYYY-MM"` → locale-aware short month + 2-digit year.

### 5. `src/messages/fr.json` + `src/messages/en.json`
- Added `bankroll.tabs.stats` ("Statistiques" / "Stats").
- Added `bankroll.advancedStats` namespace: byBookmaker, byPlayer, byMonth, bookmaker,
  player, month, profit, roi, winRate, bets, noData, noDataHint (FR/EN).

## Verification

| Check | Result |
|---|---|
| `bun run lint` | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit` (my files only) | ✅ 0 errors in use-bankroll.ts, bankroll-dialog.tsx, bet-dialog.tsx, page.tsx |
| Dev server recompile | ✅ `✓ Compiled` (no errors in dev.log) |
| `curl http://localhost:3000/` | ✅ HTTP 200 |
| JSON validity (fr/en) | ✅ both parse |
| Backward compat | ✅ optional fields; existing localStorage bets load unchanged |

Pre-existing tsc errors remain in unrelated files (examples/websocket, skills/*,
api/push, api/tennis/prematch, sentry-error-boundary, match-card, use-push-notifications)
— not introduced by this task; out of scope.

## Stats breakdown count

**3 breakdowns** delivered, exactly as specified:
1. **By bookmaker** — table (Bookmaker | Bets | Win rate | Profit | ROI)
2. **By player** — table (Player | Bets | Win rate | Profit | ROI)
3. **By month** — Recharts bar chart (profit per month, colored by sign)

All tables sorted by profit descending (computed in the hook). Empty state shown when
`stats.settledCount === 0`.

## Issues

None.

## Notes for downstream agents

- `advancedStats` is available on the `useBankroll()` return value as
  `{ byBookmaker, byPlayer, byMonth }` — each a `GroupStats[]` sorted by profit desc.
- `GroupStats` shape: `{ key, label, bets, won, lost, pending, settled, staked, profit, roi, winRate }`.
- Profit/ROI/winRate are computed over **settled bets only**; `bets`/`pending` include pending.
- If you want a **bySurface** or **byTournament** breakdown later, `Bet` now carries
  `surface`/`tournament` and `computeGroupStats` is reusable — just add two more entries
  to `advancedStats` (e.g. `bySurface: computeGroupStats(state.bets, b => b.surface || "—")`).
