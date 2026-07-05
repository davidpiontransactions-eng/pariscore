Task ID: ABTEST-1
Agent: ab-test-instrumentation-engineer
Task: In-vivo A/B test instrumentation for `tennis-prematch-chips-layout` (chips_visible control vs chips_collapsed treatment)

## Context

SetPoint — Tennis Prematch app at `/home/z/my-project`. PostHog already integrated (`src/components/analytics-provider.tsx`) with consent gating. Existing A/B scaffold in `src/app/page.tsx` reads the variant but doesn't properly attribute conversions: the `experiment_assigned` event lacks the PostHog `$feature/<flag>` convention property, no person property is set so subsequent events don't carry the variant, and there's no dev-facing way to force-switch variants for QA.

Previous agents' work records available in this `/agent-ctx` directory were reviewed (WS-1, ELO-1/2, V8-MAIN, EMAIL-1, etc.) to understand the project structure and conventions before starting.

## Work Log

### 1. PostHog experiment configuration guide
- Created `docs/` directory (did not exist).
- Created `docs/AB-TEST-SETUP.md` with:
  - Hypothesis + variants table (`chips_visible` control / `chips_collapsed` treatment, 50/50)
  - Metrics: primary = `bet_cta_click` (funnel `match_card_view` → `bet_cta_click`); secondary = `detail_open`, `bet_placed`, `favorite_toggled`; exposure = `experiment_assigned`
  - Sample-size calc: +2pp absolute lift on 10% baseline, α=0.05, power=0.80 → ~2000 users/variant (~4000 total)
  - Duration estimate: 2 weeks at ~200 visits/day
  - Step-by-step PostHog UI instructions (create feature flag → create experiment → verify exposure)
  - How the variant is propagated to events (person property + `$feature/` sentinel)
  - How to read results (significance badge, per-variant funnel drop-off, decision-rule matrix)
  - Operational checklist

### 2. Shared A/B test module
- Created `src/lib/ab-test.ts`:
  - `AB_TEST_FLAG_KEY = "tennis-prematch-chips-layout"`
  - `AB_TEST_OVERRIDE_KEY` (localStorage) + `AB_TEST_OVERRIDE_EVENT` (window CustomEvent) for the dev badge
  - `AB_TEST_VARIANTS = ["chips_visible", "chips_collapsed"] as const` + `AbTestVariant` type
  - `getAbTestOverride()` / `setAbTestOverride()` — localStorage-backed override with cross-component sync via CustomEvent
  - `asAbTestVariant()` — type guard normalizing PostHog's `string|boolean|undefined` flag value to the variant union

### 3. Analytics provider — added setPersonProperties
- Modified `src/components/analytics-provider.tsx` — added `setPersonProperties(properties)` method to `useAnalytics`. No-op when consent denied or PostHog uninitialised (mirrors the gating pattern of `track` / `identify`). This is the key piece: calling it once on assignment makes PostHog automatically attach the variant as a person property to **every** subsequent event.

### 4. Fixed the assignment effect in page.tsx
- Modified `src/app/page.tsx`:
  - Added imports from `@/lib/ab-test`
  - Pulled `setPersonProperties` from `useAnalytics`
  - Changed variant state type from `string | null` to `AbTestVariant | null`
  - Replaced the assignment effect with the instrumented version:
    1. Check `getAbTestOverride()` first — dev/QA override wins
    2. Otherwise `reloadFlags()` + `getVariant("tennis-prematch-chips-layout")` with `asAbTestVariant` normalization (default `chips_visible`)
    3. `setPersonProperties({ "tennis-prematch-chips-layout": v })` — propagates variant to **all** subsequent PostHog events automatically
    4. `track("experiment_assigned", { "$feature/tennis-prematch-chips-layout": v, experiment, variant, source })` — PostHog-convention `$feature/` sentinel property for experiment attribution
    5. `console.log(`[AB] variant=${v}`)` in dev (and `[AB] variant=${override} (overridden)` when override active)
  - Listens to `AB_TEST_OVERRIDE_EVENT` so the debug badge can force-switch in real time without a page reload
- The existing chips-visible-vs-collapsed logic is **untouched**: `chipsCollapsedByDefault={variant === "chips_collapsed"}` still drives the UI behavior, only the assignment + instrumentation changed.

### 5. Dev-only debug badge
- Created `src/components/ab-test-debug.tsx`:
  - Renders bottom-left (`fixed bottom-4 left-4 z-[100]`)
  - Shows `A/B: <variant>` with a FlaskConical icon
  - Amber styling + "override" pill when an override is active
  - Click opens a popover with both variants (`chips_visible` = Control, `chips_collapsed` = Treatment) + "Clear override" button
  - `handlePick()` calls `setAbTestOverride()` which writes localStorage + dispatches the CustomEvent → page.tsx re-assigns in real time
  - `handleClear()` removes the override → page.tsx falls back to PostHog
  - Tracks `ab_test_debug_override` with `{ experiment, from, to, cleared? }` so QA sessions can be filtered out of the production experiment analysis
  - Returns `null` when `process.env.NODE_ENV === "production"` — never ships to prod
  - Accessible: `role="region"`, `aria-label`, `aria-expanded`, `aria-haspopup`, focus-visible rings, keyboard-friendly buttons

### 6. Wired badge into layout
- Modified `src/app/layout.tsx` — imported `AbTestDebugBadge` and added it inside `<SentryErrorBoundary>` alongside the other global UI (`ConsentBanner`, `PrivacyDialog`, etc.) with a comment explaining it returns null in production.

### 7. Lint + dev server
- `bun run lint` → **0 errors, 0 warnings** (initial run had 2 unused `eslint-disable` warnings from `no-console` directives I added unnecessarily; removed them since the project's ESLint config doesn't flag `no-console`).
- Verified dev server compiles cleanly: `curl http://localhost:3000/` → 200, `dev.log` shows successful recompiles after each edit, no runtime errors.

## Summary

### Files created
- `docs/AB-TEST-SETUP.md` — PostHog experiment configuration guide
- `src/lib/ab-test.ts` — shared constants, types, localStorage override helpers
- `src/components/ab-test-debug.tsx` — dev-only floating badge with variant switcher popover

### Files modified
- `src/components/analytics-provider.tsx` — added `setPersonProperties()` to `useAnalytics` (consent-gated)
- `src/app/page.tsx` — instrumented assignment effect (`$feature/` property, `setPersonProperties`, dev `console.log`, override listener)
- `src/app/layout.tsx` — wired `AbTestDebugBadge` into the global UI tree

### Lint status
`bun run lint` → **0 errors, 0 warnings**.

### How the variant is now propagated to all events
On experiment assignment (in `src/app/page.tsx`), `setPersonProperties({ "tennis-prematch-chips-layout": v })` is called once. PostHog then **automatically attaches** this person property to **every** subsequent event fired by the same person — `match_card_view`, `bet_cta_click`, `detail_open`, `bet_placed`, `favorite_toggled`, `page_view`, etc. — without any per-call plumbing. This is the recommended PostHog pattern for experiment attribution.

Additionally, the `experiment_assigned` sentinel event carries the PostHog-convention `$feature/tennis-prematch-chips-layout` property for explicit attribution in the PostHog Experiments UI.

### Issues
None. All constraints respected:
- A/B logic (chips visible vs collapsed) untouched — only instrumentation added
- PostHog calls respect consent (all go through `useAnalytics`, which is consent-gated by `PHProvider`)
- Debug panel only renders in dev (`process.env.NODE_ENV !== "production"` returns null in prod)
- Dev server not started (already running)
- Lint passes with 0 errors / 0 warnings
