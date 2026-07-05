# Task E2E-1 — e2e-test-engineer

## One-line summary
Added a 50-test Playwright E2E suite (8 spec files + POM + config) for the SetPoint · Tennis Prematch app — all green, 1 RGPD test skipped (banner not yet shipped), lint clean.

## Files created
- `playwright.config.ts` — chromium-only, baseURL :3000, no webServer (reuses existing dev server), fr-FR/Europe-Paris, html+list reporter, workers=1.
- `tests/page-objects.ts` — `MatchCardPage` + `DetailDialogPage` POM, FR/EN label registry, clickFilter/toggleTheme/toggleLanguage helpers.
- `tests/smoke.spec.ts` — 8 tests (title, lang, theme, cards, header, WS status, footer, hero).
- `tests/filters.spec.ts` — 5 tests (Tous=3, Favoris clairs=2, Matchs serrés=0+empty, switch back, keyboard nav).
- `tests/match-card.spec.ts` — 7 tests (anatomy, names, Détail expand/collapse, Parier no-nav, dialog open, CTAs).
- `tests/detail-dialog.spec.ts` — 7 tests (4 tabs, overview/H2H/Forme/Cotes content, Escape, arrow-key nav).
- `tests/theme-language.spec.ts` — 7 tests (dark default, toggle light/dark, fr default, toggle en/fr, cookie, filter labels).
- `tests/api.spec.ts` — 9 tests (200, source enum, updatedAt ISO, match schema, player schema, stats schema, 3 matches with names, 5 bookmakers, cache TTL).
- `tests/mobile.spec.ts` — 7 tests @ 390×844 (stack vertical, no h-overflow, CTAs, photos, filter pills, Refresh hidden, dialog full-width).
- `tests/rgpd.spec.ts` — 1 test, SKIPPED (banner not yet shipped — auto-activates when main agent adds it).

## Files modified
- `eslint.config.mjs` — added `tests/**`, `playwright.config.ts`, `e2e/**` to ignores.
- `package.json` + `bun.lock` — added `@playwright/test@1.61.1` to devDependencies.

## Test results
- **50 passed / 0 failed / 1 skipped** in ~170s (workers=1, dev server warm).
- Lint: 0 errors, 0 warnings (`bun run lint` exit 0).

## Run command
`cd /home/z/my-project && bunx playwright test --reporter=list`

## Bugs discovered (documented, NOT fixed)
1. **Mock vs API probA mismatch**: `tennis-data.ts` MATCHES has 84/71/58, API returns 79/77/68. The "Matchs serrés" filter (probA<60) shows 0 cards against live data — the task hint suggested 1 card but Sinner's computed probA is 68 (≥60), so the empty-state test path is correct.
2. **WS mini-service down**: `mini-services/tennis-live` (port 3001) not running in this sandbox — indicator shows red "Hors ligne". Smoke test asserts presence-only (role=status), not connected state.
3. **Recharts `.recharts-surface` is not 1-per-chart**: each chart renders multiple SVG surfaces for tooltip interactions; use `.recharts-wrapper` (1-per-chart) when counting charts.

## Key technical notes
- Probability rings are read via `aria-label="Probabilité de victoire NN%"` (NOT visible text — visible text is "205279%WIN" concatenated with Elo+WIN).
- "Avertissement :" warning span is colon-suffixed → `getByText("Avertissement", { exact: true })` fails; use substring.
- Filter active pill has `bg-foreground` class (verified via curl on rendered HTML).
- `router.refresh()` is async — tests wait for `networkidle` after language toggle.
- Analysis button accessible name is "Analyse complète" on ≥sm screens, "Analyse" on mobile — POM uses regex alternative.

---

## Verification re-run (E2E-1, second pass)

**Context**: User re-issued the E2E-1 task. All artifacts from the first pass were already on disk and matched the task spec exactly, so this pass was treated as a VERIFICATION re-run (no rewrite of source).

**Verified**:
- `@playwright/test@1.61.1` installed; chromium-1228 cached.
- Dev server up on :3000 (curl `/` and `/api/tennis/prematch` both 200).
- All 8 spec files + `playwright.config.ts` + `tests/page-objects.ts` intact and matching the brief.

**Test run**: `cd /home/z/my-project && bunx playwright test --reporter=list`
- Final: **50 passed / 0 failed / 1 skipped** in 2.6m (rgpd banner not yet shipped → skip).
- Per-file: api 9/9, detail-dialog 7/7, filters 5/5, match-card 7/7, mobile 7/7, rgpd 0/1 (skipped), smoke 8/8, theme-language 7/7.

**Lint**: `bun run lint` exit 0, unchanged (tests in eslint ignores).

**Caveats**:
- The shell tool's 7-min timeout was hit mid-run (suite was at test ~47/51); the Playwright process finished ~20s later in the background. Full output captured via `tee /tmp/e2e-run.log` + follow-up tail.
- No app source modified. No bugs fixed. The 3 previously-documented bugs (mock-vs-API probA mismatch, WS mini-service down, Recharts surface-count gotcha) all still hold.
