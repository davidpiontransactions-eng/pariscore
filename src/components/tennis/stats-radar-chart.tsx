"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts";
import type { ServiceStats } from "@/hooks/use-tennis-live-stats";
import { cn } from "@/lib/utils";

/**
 * StatsRadarChart — Sofascore-style "Player Comparison" radar comparing
 * P1 vs P2 across 6 axes normalized to 0-100.
 *
 * Axes:
 *   1. Service          → p1_first_pct / p2_first_pct   (already 0-100)
 *   2. 1st serve won    → p1_first_won / p2_first_won   (already 0-100)
 *   3. Return           → p1_ret_won / p2_ret_won       (already 0-100)
 *   4. Total points     → p1_total_pts / p2_total_pts   (already 0-100)
 *   5. Aces             → p1_aces / p2_aces             (0-15 → 0-100)
 *   6. DF (inverse)     → 100 - df_norm                  (fewer DF = better)
 *
 * Tufte principles applied:
 *  - High data-ink ratio: faint polar grid, no chartjunk, no 3D, no gradient.
 *  - No native <Legend />: a custom legend below names the two players with
 *    their color swatch (Tufte rule 2: direct labels beat legends).
 *  - Gray default → overridden by the explicit Sofascore P1 emerald / P2 rose
 *    accents required by the spec (two-series comparison, ≤4 colors).
 *  - Plain-text tooltip (rule 14): no border, no shadow, just the values.
 *  - Accessibility: the container exposes an aria-label summarizing the chart;
 *    the tooltip is keyboard-accessible via Recharts' default focus behavior.
 *  - Performance: data transformation memoized with useMemo.
 *  - Responsive via ResponsiveContainer (fluid width, fixed compact height).
 */

/** Default Sofascore-style accents (overridable via props). */
const DEFAULT_P1_COLOR = "#00e676"; // emerald
const DEFAULT_P2_COLOR = "#ff6b6b"; // rose

/** Aces normalization ceiling. 15+ aces in a match = 100 on the radar. */
const ACES_MAX = 15;
/** DF normalization ceiling. 15+ double faults = 0 on the "Accuracy" axis. */
const DF_MAX = 15;

type RadarDatum = {
  axis: string;
  /** Translation key used to build the axis label at render time. */
  axisKey: AxisKey;
  P1: number;
  P2: number;
};

type AxisKey =
  | "serviceAxis"
  | "firstWonAxis"
  | "returnAxis"
  | "totalPtsAxis"
  | "acesAxis"
  | "dfAxis";

export interface StatsRadarChartProps {
  stats: ServiceStats;
  player1Name: string;
  player2Name: string;
  /** Override the P1 radar color (defaults to Sofascore emerald). */
  player1Color?: string;
  /** Override the P2 radar color (defaults to Sofascore rose). */
  player2Color?: string;
  className?: string;
}

/**
 * Clamp a value into [0, 100]. Null/undefined → 0 (per spec: null → 0).
 */
function clamp100(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/**
 * Linear normalization from [0, max] → [0, 100]. Null/NaN → 0.
 * Values above `max` clamp at 100.
 */
function normalizeTo100(v: number | null | undefined, max: number): number {
  if (v == null || Number.isNaN(v) || max <= 0) return 0;
  return clamp100((v / max) * 100);
}

/** Player initials for the compact legend, e.g. "Rafael Nadal" → "RN". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function StatsRadarChart({
  stats,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
  className,
}: StatsRadarChartProps) {
  const t = useTranslations("tennis");

  const p1Color = player1Color ?? DEFAULT_P1_COLOR;
  const p2Color = player2Color ?? DEFAULT_P2_COLOR;

  /**
   * Build the 6-axis dataset, applying per-axis normalization. Memoized so
   * identical `stats` references don't recompute on parent re-renders.
   */
  const data = useMemo<RadarDatum[]>(() => {
    // DF axis is inverted: fewer double faults = higher score.
    // We normalize df to 0-100 (0 df → 0, DF_MAX df → 100), then invert.
    const p1DfScore = 100 - normalizeTo100(stats.p1_df, DF_MAX);
    const p2DfScore = 100 - normalizeTo100(stats.p2_df, DF_MAX);

    return [
      {
        axis: t("serviceAxis"),
        axisKey: "serviceAxis",
        P1: clamp100(stats.p1_first_pct),
        P2: clamp100(stats.p2_first_pct),
      },
      {
        axis: t("firstWonAxis"),
        axisKey: "firstWonAxis",
        P1: clamp100(stats.p1_first_won),
        P2: clamp100(stats.p2_first_won),
      },
      {
        axis: t("returnAxis"),
        axisKey: "returnAxis",
        P1: clamp100(stats.p1_ret_won),
        P2: clamp100(stats.p2_ret_won),
      },
      {
        axis: t("totalPtsAxis"),
        axisKey: "totalPtsAxis",
        P1: clamp100(stats.p1_total_pts),
        P2: clamp100(stats.p2_total_pts),
      },
      {
        axis: t("acesAxis"),
        axisKey: "acesAxis",
        P1: normalizeTo100(stats.p1_aces, ACES_MAX),
        P2: normalizeTo100(stats.p2_aces, ACES_MAX),
      },
      {
        axis: t("dfAxis"),
        axisKey: "dfAxis",
        P1: p1DfScore,
        P2: p2DfScore,
      },
    ];
  }, [stats, t]);

  const ariaLabel = t("radarAria", { p1: player1Name, p2: player2Name });

  return (
    <div
      className={cn("flex w-full flex-col items-center gap-2", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>

      <ResponsiveContainer width="100%" height={200} minHeight={200}>
        <RadarChart
          data={data}
          outerRadius="72%"
          margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
        >
          {/* Discrete grid: faint concentric polygons, no spokes emphasis. */}
          <PolarGrid
            stroke="hsl(var(--border, 215 16% 80%))"
            strokeOpacity={0.5}
            strokeWidth={0.5}
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={{
              fontSize: 10,
              fill: "hsl(var(--muted-foreground, 215 14% 50%))",
            }}
          />
          {/* Implicit 0-100 scale, no visible radius ticks (per spec). */}
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            content={<RadarTooltip />}
            cursor={{ stroke: "hsl(var(--border))", strokeOpacity: 0.4 }}
          />
          <Radar
            name={player1Name}
            dataKey="P1"
            stroke={p1Color}
            strokeWidth={1.5}
            fill={p1Color}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Radar
            name={player2Name}
            dataKey="P2"
            stroke={p2Color}
            strokeWidth={1.5}
            fill={p2Color}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Custom legend: direct labels with color swatches + initials.
          Replaces the native <Legend /> (Tufte rule 2). */}
      <div
        className="flex w-full items-center justify-center gap-4 text-xs"
        role="list"
      >
        <LegendItem
          color={p1Color}
          name={player1Name}
          initials={initials(player1Name)}
        />
        <LegendItem
          color={p2Color}
          name={player2Name}
          initials={initials(player2Name)}
        />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  name,
  initials,
}: {
  color: string;
  name: string;
  initials: string;
}) {
  return (
    <div role="listitem" className="flex items-center gap-1.5 min-w-0">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span
        className="font-mono text-[10px] font-semibold tabular-nums shrink-0"
        style={{ color }}
      >
        {initials}
      </span>
      <span className="truncate text-muted-foreground">{name}</span>
    </div>
  );
}

/**
 * Plain-text tooltip (Tufte rule 14): no border, no shadow, no decorative
 * background — just the axis label and each player's value.
 */
function RadarTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const axisLabel = payload[0]?.payload?.axis ?? "";
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1 text-xs leading-tight">
      <div className="font-medium text-foreground">{axisLabel}</div>
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey)}
          className="flex items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {typeof entry.value === "number" ? entry.value.toFixed(0) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default StatsRadarChart;
