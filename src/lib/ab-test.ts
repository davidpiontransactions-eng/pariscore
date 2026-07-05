/**
 * A/B test constants and override helpers for the
 * `tennis-prematch-chips-layout` experiment.
 *
 * Shared between:
 *  - `src/app/page.tsx` (assignment effect)
 *  - `src/components/ab-test-debug.tsx` (dev-only debug badge)
 *
 * The override is stored in localStorage so QA can force-switch variants
 * without touching PostHog. A custom window event is dispatched on change
 * so the assignment effect can react in real time.
 */

export const AB_TEST_FLAG_KEY = "tennis-prematch-chips-layout";

/** localStorage key used by the debug panel to force a variant for QA. */
export const AB_TEST_OVERRIDE_KEY = "ab-override:tennis-prematch-chips-layout";

/** Custom window event dispatched when the override changes. */
export const AB_TEST_OVERRIDE_EVENT = "ab-test-override-changed";

export const AB_TEST_VARIANTS = ["chips_visible", "chips_collapsed"] as const;
export type AbTestVariant = (typeof AB_TEST_VARIANTS)[number];

/**
 * Default variant when PostHog is disabled (no `NEXT_PUBLIC_POSTHOG_KEY`)
 * or when the flag is not yet loaded.
 */
export const AB_TEST_DEFAULT_VARIANT: AbTestVariant = "chips_visible";

/**
 * Read the dev/QA override from localStorage. Returns `null` if no valid
 * override is set or if running on the server.
 */
export function getAbTestOverride(): AbTestVariant | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(AB_TEST_OVERRIDE_KEY);
    if (v === "chips_visible" || v === "chips_collapsed") return v;
  } catch {
    /* localStorage may be blocked (private mode) — ignore */
  }
  return null;
}

/**
 * Set (or clear) the dev/QA override and dispatch a window event so the
 * assignment effect in `src/app/page.tsx` re-runs and the UI updates.
 */
export function setAbTestOverride(variant: AbTestVariant | null): void {
  if (typeof window === "undefined") return;
  try {
    if (variant === null) {
      window.localStorage.removeItem(AB_TEST_OVERRIDE_KEY);
    } else {
      window.localStorage.setItem(AB_TEST_OVERRIDE_KEY, variant);
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent<AbTestVariant | null>(AB_TEST_OVERRIDE_EVENT, {
      detail: variant,
    }),
  );
}

/**
 * Type guard for the variant string coming from PostHog (which types it as
 * `string | boolean | undefined`). PostHog multivariate flags return
 * strings, but the type union forces us to handle booleans too.
 */
export function asAbTestVariant(
  v: string | boolean | null | undefined,
): AbTestVariant {
  return v === "chips_collapsed" ? "chips_collapsed" : "chips_visible";
}
