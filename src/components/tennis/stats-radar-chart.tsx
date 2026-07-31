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
import { cn } from "@/lib/utils";

/**
 * StatsRadarChart — Sofascore-style radar comparing one or two players
 * across 6 axes normalized to 0-100.
 *
 * Axes (6 metrics):
 *   1. Service       → first serve %         (0-100)
 *   2. 1st won       → first serve won %     (0-100)
 *   3. Return        → return points won %   (0-100)
 *   4. Total pts     → total points won %    (0-100)
 *   5. Aces          → ace count             (0-15 → 0-100)
 *   6. DF Accuracy   → 100 − df_norm         (fewer DF = better)
 *
 * Features:
 *  - Single-player or two-player overlay (dataB is optional).
 *  - Responsive dark theme via CSS custom properties.
 *  - Custom legend below the chart with color swatches + initials.
 *  - Tufte-style plain-text tooltip (no border/shadow/gradient).
 *  - Accessible: aria-label + sr-only summary.
 */

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_COLOR_A = "#00e676"; // emerald
const DEFAULT_COLOR_B = "#ff6b6b"; // rose

/** Raw ace count ceiling — 15+ aces → 100 on the radar. */
const ACES_MAX = 15;
/** Raw DF ceiling — 15+ DFs → 0 on the "DF Accuracy" axis. */
const DF_MAX = 15;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One player's raw stats across the 6 radar axes. */
export interface RadarPlayerData {
  /** First serve percentage (0–100). */
  service: number;
  /** First serve points won percentage (0–100). */
  firstServeWon: number;
  /** Return points won percentage (0–100). */
  returnWon: number;
  /** Total points won percentage (0–100). */
  totalPointsWon: number;
  /** Raw ace count (normalized 0–15 → 0–100). */
  aces: number;
  /** Raw double-fault count (inverted: 0–15 → 100–0). */
  doubleFaults: number;
}

export interface StatsRadarChartProps {
  /** Primary player data (required). */
  dataA: RadarPlayerData;
  /** Secondary player data for overlay comparison (optional). */
  dataB?: RadarPlayerData;
  /** Label for player A (defaults to "Player A"). */
  playerAName?: string;
  /** Label for player B (defaults to "Player B"). */
  playerBName?: string;
  /** Radar stroke/fill color for player A. */
  colorA?: string;
  /** Radar stroke/fill color for player B. */
  colorB?: string;
  className?: string;
}

type AxisKey =
  | "serviceAxis"
  | "firstWonAxis"
  | "returnAxis"
  | "totalPtsAxis"
  | "acesAxis"
  | "dfAxis";

type RadarDatum = {
  axis: string;
  axisKey: AxisKey;
  playerA: number;
  playerB: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp100(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function normalizeTo100(v: number | null | undefined, max: number): number {
  if (v == null || Number.isNaN(v) || max <= 0) return 0;
  return clamp100((v / max) * 100);
}

/** Player initials e.g. "Rafael Nadal" → "RN". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatsRadarChart({
  dataA,
  dataB,
  playerAName = "Player A",
  playerBName = "Player B",
  colorA,
  colorB,
  className,
}: StatsRadarChartProps) {
  const t = useTranslations("tennis");

  const aColor = colorA ?? DEFAULT_COLOR_A;
  const bColor = colorB ?? DEFAULT_COLOR_B;
  const hasOverlay = dataB != null;

  const data = useMemo<RadarDatum[]>(() => {
    const aDfScore = 100 - normalizeTo100(dataA.doubleFaults, DF_MAX);
    const bDfScore = hasOverlay
      ? 100 - normalizeTo100(dataB!.doubleFaults, DF_MAX)
      : 0;

    return [
      {
        axis: t("serviceAxis"),
        axisKey: "serviceAxis",
        playerA: clamp100(dataA.service),
        playerB: hasOverlay ? clamp100(dataB!.service) : 0,
      },
      {
        axis: t("firstWonAxis"),
        axisKey: "firstWonAxis",
        playerA: clamp100(dataA.firstServeWon),
        playerB: hasOverlay ? clamp100(dataB!.firstServeWon) : 0,
      },
      {
        axis: t("returnAxis"),
        axisKey: "returnAxis",
        playerA: clamp100(dataA.returnWon),
        playerB: hasOverlay ? clamp100(dataB!.returnWon) : 0,
      },
      {
        axis: t("totalPtsAxis"),
        axisKey: "totalPtsAxis",
        playerA: clamp100(dataA.totalPointsWon),
        playerB: hasOverlay ? clamp100(dataB!.totalPointsWon) : 0,
      },
      {
        axis: t("acesAxis"),
        axisKey: "acesAxis",
        playerA: normalizeTo100(dataA.aces, ACES_MAX),
        playerB: hasOverlay ? normalizeTo100(dataB!.aces, ACES_MAX) : 0,
      },
      {
        axis: t("dfAxis"),
        axisKey: "dfAxis",
        playerA: aDfScore,
        playerB: bDfScore,
      },
    ];
  }, [dataA, dataB, hasOverlay, t]);

  const nameA = playerAName || "Player A";
  const nameB = playerBName || "Player B";

  const ariaLabel = hasOverlay
    ? t("radarAria", { p1: nameA, p2: nameB })
    : `${nameA} stats radar`;

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
            name={nameA}
            dataKey="playerA"
            stroke={aColor}
            strokeWidth={1.5}
            fill={aColor}
            fillOpacity={0.15}
            isAnimationActive={false}
          />
          {hasOverlay && (
            <Radar
              name={nameB}
              dataKey="playerB"
              stroke={bColor}
              strokeWidth={1.5}
              fill={bColor}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>

      {/* Custom legend: direct labels with color swatches + initials. */}
      <div
        className="flex w-full items-center justify-center gap-4 text-xs"
        role="list"
      >
        <LegendItem
          color={aColor}
          name={nameA}
          initials={initials(nameA)}
        />
        {hasOverlay && (
          <LegendItem
            color={bColor}
            name={nameB}
            initials={initials(nameB)}
          />
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LegendItem({
  color,
  name,
  initials: init,
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
        {init}
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
