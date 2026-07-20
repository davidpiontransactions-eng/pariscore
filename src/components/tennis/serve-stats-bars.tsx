"use client";

import { useTranslations } from "next-intl";
import type { ServiceStats } from "@/hooks/use-tennis-live-stats";
import { cn } from "@/lib/utils";

/**
 * ServeStatsBars — diverging horizontal bar chart comparing serve stats
 * between two players (Sofascore "Performance" style).
 *
 * Tufte principles applied:
 *  - High data-ink ratio: bars + direct labels, no chartjunk.
 *  - Direct labeling (name + value on each side), no legend.
 *  - Gray first, accent selectively: winner in emerald, loser in muted gray.
 *  - No gridlines, no borders, no 3D, no decorative gradients.
 *  - Range encoded by bar length (0–100%); center axis is the implicit zero.
 *  - Accessible: each row exposes an aria-label stating the finding.
 */

type StatRowKey = {
  p1Key: keyof ServiceStats;
  p2Key: keyof ServiceStats;
  labelKey: "firstServePct" | "firstServeWonPct" | "returnWonPct";
};

const ROWS: StatRowKey[] = [
  { p1Key: "p1_first_pct", p2Key: "p2_first_pct", labelKey: "firstServePct" },
  { p1Key: "p1_first_won", p2Key: "p2_first_won", labelKey: "firstServeWonPct" },
  { p1Key: "p1_ret_won", p2Key: "p2_ret_won", labelKey: "returnWonPct" },
];

const BAR_TRACK_HEIGHT = "h-2";

export interface ServeStatsBarsProps {
  stats: ServiceStats;
  player1Name: string;
  player2Name: string;
  /** Override the winner color for player 1 (defaults to emerald). */
  player1Color?: string;
  /** Override the winner color for player 2 (defaults to emerald). */
  player2Color?: string;
  className?: string;
}

export function ServeStatsBars({
  stats,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
  className,
}: ServeStatsBarsProps) {
  const t = useTranslations("tennis");

  return (
    <div
      className={cn("w-full space-y-3.5", className)}
      role="list"
      aria-label={t("firstServePct")}
    >
      {ROWS.map((row) => {
        const v1 = stats[row.p1Key] as number | null;
        const v2 = stats[row.p2Key] as number | null;
        const stat = t(row.labelKey);

        const p1Wins = v1 !== null && v2 !== null && v1 > v2;
        const p2Wins = v1 !== null && v2 !== null && v2 > v1;
        const tied = v1 !== null && v2 !== null && v1 === v2;

        // Winner fill: explicit override (style attr) or emerald token via class.
        // Loser fill: muted (gray-first, Tufte rule 8).
        const p1FillClass = p1Wins ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground/40";
        const p2FillClass = p2Wins ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground/40";

        const p1BarStyle =
          p1Wins && player1Color ? { backgroundColor: player1Color } : undefined;
        const p2BarStyle =
          p2Wins && player2Color ? { backgroundColor: player2Color } : undefined;

        // Bar width as percentage of half-track (each side = 0–100%).
        const p1Width = v1 !== null ? `${Math.max(0, Math.min(100, v1))}%` : "0%";
        const p2Width = v2 !== null ? `${Math.max(0, Math.min(100, v2))}%` : "0%";

        const ariaLabel = buildAriaLabel({
          t,
          stat,
          v1,
          v2,
          p1Name: player1Name,
          p2Name: player2Name,
          p1Wins,
          p2Wins,
          tied,
        });

        return (
          <div
            key={row.p1Key}
            role="listitem"
            aria-label={ariaLabel}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          >
            {/* Player 1 — name + value, right-aligned; bar grows leftward from center */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-baseline justify-end gap-2 min-w-0">
                <span
                  className={cn(
                    "truncate text-right text-xs text-muted-foreground",
                    p1Wins && "text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {player1Name}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums font-semibold",
                    p1Wins ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                  )}
                >
                  {v1 !== null ? t("statSuffix", { n: v1 }) : "--"}
                </span>
              </div>
              <div className={cn("w-full flex justify-end", BAR_TRACK_HEIGHT)}>
                <div
                  className={cn("h-full rounded-l-sm transition-[width] duration-300 ease-out", p1FillClass)}
                  style={{ width: p1Width, ...p1BarStyle }}
                />
              </div>
            </div>

            {/* Center label */}
            <div className="flex flex-col items-center px-1 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                {stat}
              </span>
            </div>

            {/* Player 2 — name + value, left-aligned; bar grows rightward from center */}
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums font-semibold",
                    p2Wins ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                  )}
                >
                  {v2 !== null ? t("statSuffix", { n: v2 }) : "--"}
                </span>
                <span
                  className={cn(
                    "truncate text-left text-xs text-muted-foreground",
                    p2Wins && "text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {player2Name}
                </span>
              </div>
              <div className={cn("w-full flex justify-start", BAR_TRACK_HEIGHT)}>
                <div
                  className={cn("h-full rounded-r-sm transition-[width] duration-300 ease-out", p2FillClass)}
                  style={{ width: p2Width, ...p2BarStyle }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AriaArgs = {
  t: ReturnType<typeof useTranslations>;
  stat: string;
  v1: number | null;
  v2: number | null;
  p1Name: string;
  p2Name: string;
  p1Wins: boolean;
  p2Wins: boolean;
  tied: boolean;
};

function buildAriaLabel({
  t,
  stat,
  v1,
  v2,
  p1Name,
  p2Name,
  p1Wins,
  p2Wins,
  tied,
}: AriaArgs): string {
  if (v1 === null || v2 === null) {
    return t("ariaNoData", { stat });
  }
  const leader = p1Wins ? p1Name : p2Wins ? p2Name : "";
  if (tied || !leader) {
    return t("ariaTie", { a: v1, b: v2, stat });
  }
  return t("ariaLead", { a: v1, b: v2, stat, leader });
}
