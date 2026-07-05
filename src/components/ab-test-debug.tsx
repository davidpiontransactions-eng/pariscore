"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X, RefreshCw } from "lucide-react";
import { useAnalytics } from "@/components/analytics-provider";
import {
  AB_TEST_FLAG_KEY,
  AB_TEST_OVERRIDE_EVENT,
  AB_TEST_VARIANTS,
  asAbTestVariant,
  getAbTestOverride,
  setAbTestOverride,
  type AbTestVariant,
} from "@/lib/ab-test";
import { cn } from "@/lib/utils";

/**
 * Dev-only floating badge that surfaces the current A/B variant for the
 * `tennis-prematch-chips-layout` experiment and lets QA force-switch it.
 *
 * Rendered only when `process.env.NODE_ENV !== "production"` — never
 * shipped to production. See `docs/AB-TEST-SETUP.md` for the full
 * experiment plan.
 *
 * Behaviour:
 *  - Shows "A/B: <variant>" bottom-left of the viewport.
 *  - Click opens a small popover with the two variants + a "clear
 *    override" button.
 *  - Selecting a variant writes to localStorage and dispatches the
 *    `ab-test-override-changed` event; the assignment effect in
 *    `src/app/page.tsx` listens and re-assigns.
 *  - Each manual override fires the `ab_test_debug_override` analytics
 *    event so we can filter those QA sessions out of the production
 *    experiment analysis.
 */
export function AbTestDebugBadge() {
  const { track, getVariant, reloadFlags } = useAnalytics();
  const [variant, setVariant] = useState<AbTestVariant | null>(null);
  const [overridden, setOverridden] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync local state with the assignment source (override OR PostHog flag).
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const override = getAbTestOverride();
      if (override) {
        if (cancelled) return;
        setVariant(override);
        setOverridden(true);
        return;
      }
      // No override — read the flag from PostHog (best-effort; falls back
      // to the control variant when PostHog is not configured).
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        await reloadFlags();
      }
      if (cancelled) return;
      const flag = process.env.NEXT_PUBLIC_POSTHOG_KEY
        ? getVariant(AB_TEST_FLAG_KEY)
        : null;
      setVariant(asAbTestVariant(flag ?? AB_TEST_VARIANTS[0]));
      setOverridden(false);
    };

    sync();

    const onOverrideChange = () => sync();
    window.addEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    return () => {
      cancelled = true;
      window.removeEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    };
  }, [getVariant, reloadFlags]);

  // Never render in production. This check + the dev-only import gate in
  // `layout.tsx` (the component is dynamically imported with `ssr: false`)
  // ensures the badge never leaks to a prod build.
  if (process.env.NODE_ENV === "production") return null;

  const handlePick = (next: AbTestVariant) => {
    const from = variant;
    setAbTestOverride(next);
    // Track for filtering QA sessions out of the production experiment.
    track("ab_test_debug_override", {
      experiment: AB_TEST_FLAG_KEY,
      from,
      to: next,
    });
    setOpen(false);
  };

  const handleClear = () => {
    const from = variant;
    setAbTestOverride(null);
    track("ab_test_debug_override", {
      experiment: AB_TEST_FLAG_KEY,
      from,
      to: null,
      cleared: true,
    });
    setOpen(false);
  };

  return (
    <div
      className="fixed bottom-4 left-4 z-[100] select-none font-sans"
      role="region"
      aria-label="A/B test debug badge"
    >
      {/* Toggle button — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg",
          "backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98]",
          overridden
            ? "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "border-border/60 bg-background/85 text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        title={
          overridden
            ? `A/B override active: ${variant}`
            : `A/B variant: ${variant}`
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        <span className="font-mono">
          A/B: {variant ?? "…"}
        </span>
        {overridden && (
          <span className="ml-0.5 rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
            override
          </span>
        )}
      </button>

      {/* Popover — variant switcher */}
      {open && (
        <div
          role="dialog"
          aria-label="Force A/B variant"
          className={cn(
            "mt-2 w-60 overflow-hidden rounded-xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-md",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Force variant (QA)
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-1.5">
            {AB_TEST_VARIANTS.map((v) => {
              const isActive = variant === v && overridden;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => handlePick(v)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-amber-500/10",
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-mono font-semibold">{v}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {v === "chips_visible"
                        ? "Control — chips visible"
                        : "Treatment — chips collapsed"}
                    </span>
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border/60 p-1.5">
            <button
              type="button"
              onClick={handleClear}
              disabled={!overridden}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <RefreshCw className="h-3 w-3" />
              Clear override (use PostHog)
            </button>
          </div>

          <p className="border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
            Override is stored in localStorage and only affects this browser.
            It is ignored in production.
          </p>
        </div>
      )}
    </div>
  );
}
