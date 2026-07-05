"use client";

import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { computeBacktestAccuracy } from "@/lib/prediction/backtest";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  surface: string;
  eloGap: number;
  className?: string;
};

/**
 * Backtest badge — shows the historical accuracy of the prediction engine
 * on matches similar to the current one (same surface + same Elo-gap
 * bucket). Color-coded:
 *   green  ≥ 80%
 *   amber  65-79%
 *   red    < 65%
 *   muted  no data
 *
 * Pure & synchronous — the lookup is a hardcoded table, no network call.
 * The companion API route `/api/tennis/backtest` exposes the same data
 * for external consumers / curl tests.
 */
export function BacktestBadge({ surface, eloGap, className }: Props) {
  const t = useTranslations("match.backtest");

  const { accuracy, sampleSize, bucket } = useMemo(
    () => computeBacktestAccuracy(surface, eloGap),
    [surface, eloGap]
  );

  if (accuracy === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground",
              className
            )}
          >
            <Target className="h-3 w-3" aria-hidden />
            {t("noData")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("noData")}</TooltipContent>
      </Tooltip>
    );
  }

  const tone =
    accuracy >= 80
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : accuracy >= 65
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400";

  const tooltip = t("tooltip", {
    n: sampleSize,
    surface,
    bucket: bucket ?? "?",
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            tone,
            className
          )}
          aria-label={`${t("label")}: ${accuracy}% (n=${sampleSize})`}
        >
          <Target className="h-3 w-3" aria-hidden />
          {t("label")}: {accuracy}% (n={sampleSize})
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
