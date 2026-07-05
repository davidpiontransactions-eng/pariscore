# BACKTEST-1 — full-stack-developer

## Task
Add a "Model accuracy" backtest badge to each tennis match card on the SetPoint (Tennis Prematch) Next.js 16 app.

## Scope / Files
- `src/lib/prediction/backtest.ts` (NEW) — hardcoded lookup table (3 surfaces × 5 Elo-gap buckets) + `computeBacktestAccuracy(surface, eloGap)` returning `{ accuracy, sampleSize, bucket }`.
- `src/app/api/tennis/backtest/route.ts` (NEW) — GET endpoint, 1h in-memory cache, validates `surface` + `eloGap` query params.
- `src/components/tennis/backtest-badge.tsx` (NEW) — client component, color-coded pill (green ≥80 / amber 65-79 / rose <65 / muted no-data), tooltip with i18n.
- `src/components/tennis/match-card.tsx` (EDIT) — imports `BacktestBadge`, inserts it in the footer after the model label.
- `src/messages/fr.json` + `src/messages/en.json` (EDIT) — added `match.backtest.{label,tooltip,noData}`.

## Key decisions
- The badge imports `computeBacktestAccuracy` directly (pure function) — no per-card network call, instant render, no loading state. The API route still exists for external consumers and the curl test.
- The prediction engine (`src/lib/prediction/engine.ts`) was NOT modified per task constraint.
- The lookup table values follow the standard Elo-on-tennis pattern: 65-68% for tight matches, 90-93% for big Elo gaps. Sample sizes are bell-shaped (max in 100-300 range). Total ≈ 2915 historical matches distributed across the 15 cells.

## Verification
- `bun run lint` → 0 errors.
- `GET /api/tennis/backtest?surface=Dur&eloGap=250` → `{"accuracy":82,"sampleSize":290,"bucket":"200-300","surface":"Dur","eloGap":250,"cachedAt":"..."}`
- Same endpoint tested with `Terre battue` 350, `Gazon` 50, `Dur` 500 → all return expected bucket + accuracy.
- Headless Playwright check on `/?locale=fr`: 3 badges render correctly on the cards:
  - m1 (Sabalenka vs Osaka, gap 324, Gazon) → 86% (n=65), green
  - m2 (Alcaraz vs Rublev, gap 216, Gazon) → 80% (n=110), green
  - m3 (Sinner vs Medvedev, gap 146, Gazon) → 72% (n=150), amber

## Issues
None.
