# A/B Test Setup — `tennis-prematch-chips-layout`

This document describes how to configure, run, and read the in-vivo A/B test
that measures the conversion impact of showing vs collapsing the stats chips
on the SetPoint tennis prematch match cards.

> **Test ID:** `tennis-prematch-chips-layout`
> **Owner:** Growth + Analytics
> **Status:** instrumentation shipped (task `ABTEST-1`), experiment **draft** in PostHog UI.

---

## 1. Hypothesis & variants

| Variant key            | Role        | Description                                                            |
| ---------------------- | ----------- | --------------------------------------------------------------------- |
| `chips_visible`        | Control (A) | Stats chips (form, Elo gap, surface, H2H, IC, confidence) are visible by default. |
| `chips_collapsed`      | Treatment (B) | Stats chips are hidden behind a "See stats" toggle by default.        |

**Split:** 50 / 50 (uniform rollout).

**Hypothesis (B):** collapsing the chips reduces visual noise on the match
card and *increases* the primary conversion rate (CTA `bet` click).

**Counter-hypothesis (A):** hiding the model transparency signals reduces
trust and *decreases* the conversion rate.

---

## 2. Metrics

| Type        | Event            | Definition                                                        |
| ----------- | ---------------- | ---------------------------------------------------------------- |
| **Primary** | `bet_cta_click`  | User clicks the green "Bet" CTA on a match card.                 |
| Secondary   | `detail_open`    | User opens the inline detail accordion on a match card.          |
| Secondary   | `bet_placed`     | User actually places a bet in the BetDialog (bankroll entry).    |
| Secondary   | `favorite_toggled` | User stars / unstars a match.                                  |
| Exposure    | `experiment_assigned` | User is assigned a variant on first page load (sentinel event). |

### Primary funnel

```
match_card_view  →  bet_cta_click
```

Conversion rate = `bet_cta_click` / `match_card_view`, computed **per variant**.
PostHog will attribute each event to a variant automatically because the
variant is stored as a person property (`tennis-prematch-chips-layout`)
on assignment — see §5.

### Guardrail metrics (watch list, no stop rule)

- `detail_open` rate (we don't want the treatment to kill exploration)
- `favorite_toggled` rate
- `bet_placed` rate (downstream of `bet_cta_click` — measures quality, not just clicks)

---

## 3. Sample size & duration

**Detection target:** +2 percentage points absolute lift on `bet_cta_click`
conversion (e.g. baseline 10% → 12%).

| Parameter        | Value    |
| ---------------- | -------- |
| Baseline rate    | 10%      |
| MDE (absolute)   | +2pp     |
| α (significance) | 0.05     |
| Power (1 − β)    | 0.80     |
| Variant split    | 50 / 50  |
| Required sample  | **~2 000 users per variant** (≈ 4 000 total) |

> Computed with a two-proportion z-test. PostHog's built-in sample-size
> calculator (Experiments → New → "Minimum sample size") will return the
> same number when fed the parameters above.

**Duration estimate:** the SetPoint prematch page currently sees
**~200 unique visitors / day**.

```
4 000 users / 200 users/day ≈ 20 days  →  round up to  ~2 weeks of clean traffic
```

Plan for a **2-week minimum run**, no peeking before day 7 (early stopping
inflates false-positive rate). Do not stop the test before the required
sample size is reached *even if* PostHog shows significance earlier.

---

## 4. PostHog UI — step-by-step experiment creation

These steps assume you are signed in to the PostHog project that matches the
`NEXT_PUBLIC_POSTHOG_KEY` env var wired in `src/components/analytics-provider.tsx`.

### 4.1. Create the feature flag

1. Open **Feature flags** → **New feature flag**.
2. **Key:** `tennis-prematch-chips-layout`  *(must match the JS string literal exactly — underscores, not hyphens inside the key).*
3. **Name:** `Tennis Prematch — Chips Layout`
4. **Type:** Multivariate (A/B test)
5. Add **two variants**:
   - `chips_visible` — rollout 50%
   - `chips_collapsed` — rollout 50%
6. (Optional) Add an empty `control` if you want a no-op baseline — *not required here*.
7. **Rollout:** 100% of users (the 50/50 split lives inside the variants, not the rollout %).
8. Save. Confirm the flag is **active**.

### 4.2. Create the experiment

1. Open **Experiments** → **New experiment**.
2. **Name:** `Tennis Prematch — Chips Layout`
3. **Feature flag:** select `tennis-prematch-chips-layout` (created in 4.1).
4. **Goal metric:** `bet_cta_click` — funnel:
   - Step 1: `match_card_view`
   - Step 2: `bet_cta_click`
5. **Secondary metrics:** add
   - `detail_open`
   - `bet_placed`
   - `favorite_toggled`
6. **Minimum sample size:** 2 000 per variant (PostHog will prefill after you enter baseline + MDE).
7. **Expected conversion:** 10% baseline, 12% expected.
8. Save as **draft** → click **Launch** when ready.
9. Confirm the **status** moves to `Running`.

### 4.3. Verify exposure

Within ~5 minutes of launch:

1. Open **Activity** → **Events** in PostHog.
2. Filter by event name = `experiment_assigned`.
3. Confirm each event carries:
   - `$feature/tennis-prematch-chips-layout` = `chips_visible` **or** `chips_collapsed`
   - `experiment` = `tennis-prematch-chips-layout`
   - `variant` = (same value as above)
4. Open a sample person profile → **Properties** → confirm a person property
   named `tennis-prematch-chips-layout` is set on the profile.

If the `$feature/...` property is missing, the assignment effect in
`src/app/page.tsx` did not run — usually means consent was denied or
PostHog was not initialised (see `analytics-provider.tsx`).

---

## 5. How the variant is propagated to events

Two complementary mechanisms — **both** are wired in the code:

### 5.1. Person property (automatic, recommended)

On experiment assignment, `src/app/page.tsx` calls:

```ts
posthog.setPersonProperties({
  "tennis-prematch-chips-layout": variant,
});
```

PostHog then **automatically attaches** this property to **every subsequent
event** fired by that person — `match_card_view`, `bet_cta_click`,
`detail_open`, `bet_placed`, `favorite_toggled`, `page_view`, etc.

This is the recommended path because it requires zero per-call plumbing and
survives refactors.

### 5.2. `$feature/` sentinel on the assignment event

The `experiment_assigned` event itself is captured with the PostHog
convention property:

```ts
track("experiment_assigned", {
  $feature: { "tennis-prematch-chips-layout": variant },
  experiment: "tennis-prematch-chips-layout",
  variant,
});
```

The `$feature/...` key is what PostHog's Experiments UI uses to *attribute
exposure*. Pairing it with the person-property approach above means the
experiment shows up both in the Experiments dashboard and in any ad-hoc
insight broken down by `tennis-prematch-chips-layout`.

---

## 6. Reading the results

Once the experiment reaches the minimum sample size (or the duration cap),
open **Experiments** → `Tennis Prematch — Chips Layout`.

### 6.1. The headline number

The top of the page shows, for the **primary funnel**
(`match_card_view` → `bet_cta_click`):

- Conversion rate per variant (with confidence interval)
- Absolute lift (pp) and relative lift (%)
- **Significance** badge:
  - ✅ **Significant** → `p < 0.05` (probability the lift is real ≥ 95%)
  - ⚪ **Not significant yet** → keep waiting, do not call it
  - ❌ **Inconclusive** → reached sample size, no detectable lift

### 6.2. Per-variant funnel drop-off

Scroll to the funnel breakdown:

| Step                | `chips_visible` (A) | `chips_collapsed` (B) | Δ        |
| ------------------- | ------------------- | -------------------- | -------- |
| `match_card_view`   | 2 013               | 1 988                | −1.2%    |
| `bet_cta_click`     | 205 (10.2%)         | 247 (12.4%)          | **+2.2pp** |

If B's drop-off from `match_card_view` → `bet_cta_click` is smaller than
A's, the treatment is winning on the primary metric.

### 6.3. Secondary metrics

Below the primary funnel, PostHog shows each secondary metric's per-variant
delta:

- **`detail_open`** — if it *plummets* on B, the treatment is hiding the
  stats people actually wanted. Watch even if the primary metric wins.
- **`bet_placed`** — downstream of the primary. If clicks go up but placed
  bets don't, the treatment generated *low-intent* clicks. That's a
  Pyrrhic win.
- **`favorite_toggled`** — engagement proxy. A drop here suggests B feels
  less informative.

### 6.4. Decision rule

| Outcome                                                            | Action                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| Primary **significant +2pp or more** AND secondaries not cratering | Ship B (`chips_collapsed`) at 100%.                    |
| Primary **significant −2pp or worse**                              | Stop, keep A (`chips_visible`).                        |
| Primary **inconclusive** at the sample-size cap                    | Keep A as default; consider a follow-up test with sharper MDE. |
| Primary up, but `bet_placed` **down** significantly                | Hold; investigate if clicks are low-intent.            |

---

## 7. Debug panel (dev only)

A floating badge is rendered bottom-left of every page when
`process.env.NODE_ENV !== "production"` (`src/components/ab-test-debug.tsx`).
It shows the current variant and lets QA force-switch the variant locally
without touching PostHog.

- The override is stored in `localStorage` and re-applied on every page
  load.
- Each manual override fires the `ab_test_debug_override` event with
  `{ from, to, experiment }` so we can filter those sessions out of the
  production analysis if needed.

In production the badge is **not** rendered, and the override path is a
no-op.

---

## 8. Operational checklist

- [ ] Feature flag `tennis-prematch-chips-layout` created (50/50)
- [ ] Experiment launched with primary = `bet_cta_click` funnel
- [ ] `experiment_assigned` events visible in PostHog with `$feature/...` property
- [ ] Person property `tennis-prematch-chips-layout` set on profiles
- [ ] Dev badge shows correct variant locally
- [ ] Calendar reminder set for the minimum 7-day no-peeking window
- [ ] Calendar reminder set for the 2-week end-of-test date
- [ ] Decision-rule bookmarked (§6.4) for the readout meeting
