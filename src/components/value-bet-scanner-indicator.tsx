"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellRing, Calendar, CalendarCheck } from "lucide-react";
import { useValueBetScanner } from "@/hooks/use-value-bet-scanner";
import {
  useDigestScheduler,
  setDigestEnabled,
} from "@/hooks/use-digest-scheduler";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Discrete indicator showing the value bet scanner status + a small daily
 * digest toggle, shown in the header next to the other toggles.
 *
 * - Scanner bell:
 *   - No alert + no subscriptions: muted bell icon
 *   - Alert sent: emerald bell with pulse + count
 * - Calendar button (next to the bell):
 *   - Click toggles daily digest mode (localStorage `setpoint-digest-enabled`).
 *   - When ON, individual value bet alerts are suppressed (see
 *     `use-value-bet-scanner.ts`) and the digest scheduler hook sends a
 *     single grouped notification once per 24h.
 *   - Muted Calendar icon when OFF, emerald CalendarCheck icon when ON.
 */
export function ValueBetScannerIndicator() {
  const t = useTranslations("scanner");
  const tDigest = useTranslations("digest");
  const { lastScanAt, alertsSent } = useValueBetScanner();
  // Mount the scheduler here so it runs whenever the indicator is in the
  // header — the hook returns the current toggle/timestamp state for
  // display purposes and is otherwise side-effect-only.
  const { enabled: digestOn, lastSent } = useDigestScheduler();
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount. Deferred setState (microtask) to
  // satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const hasAlerts = alertsSent > 0;

  const toggleDigest = () => {
    // The hook listens for the custom event dispatched by setDigestEnabled
    // and updates its `enabled` state — no local setState needed here.
    setDigestEnabled(!digestOn);
  };

  const digestTooltip = digestOn ? tDigest("tooltipOn") : tDigest("tooltip");

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-8 items-center gap-0.5">
        {/* Scanner bell + count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
              role="status"
              aria-label={t("status")}
            >
              {hasAlerts ? (
                <BellRing
                  className={cn(
                    "h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400",
                    hasAlerts && "animate-pulse"
                  )}
                />
              ) : (
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {alertsSent > 0 && (
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {alertsSent}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 text-xs">
              <div className="font-semibold">{t("status")}</div>
              <div className="text-muted-foreground">
                {alertsSent > 0
                  ? t("alertsSent", { n: alertsSent })
                  : t("noAlerts")}
              </div>
              {lastScanAt && (
                <div className="text-[10px] text-muted-foreground/70">
                  {t("lastScan")}: {new Date(lastScanAt).toLocaleTimeString()}
                </div>
              )}
              <div className="pt-1 text-[10px] text-muted-foreground/70">
                {t("description")}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Daily digest toggle (calendar icon) */}
        {mounted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleDigest}
                aria-label={
                  digestOn ? tDigest("disable") : tDigest("enable")
                }
                aria-pressed={digestOn}
                className={cn(
                  "flex h-8 w-7 items-center justify-center rounded-md transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  digestOn
                    ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {digestOn ? (
                  <CalendarCheck className="h-3.5 w-3.5" />
                ) : (
                  <Calendar className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <div className="font-semibold">{tDigest("title")}</div>
                <div className="text-muted-foreground">{digestTooltip}</div>
                {digestOn && lastSent > 0 && (
                  <div className="text-[10px] text-muted-foreground/70">
                    {new Date(lastSent).toLocaleString()}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

