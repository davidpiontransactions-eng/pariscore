"use client";

import { useMemo } from "react";
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
import {
  RADAR_AXIS_LABELS,
  RADAR_AXIS_ORDER,
  type RadarAxisKey,
  type RadarMatchData,
} from "@/lib/football-radar";

/**
 * FootballRadarChart — Radar chart FotMob-style comparant home vs away
 * sur 6 axes (Rating, Squad, Goalkeepers, Defence, Midfield, Attack).
 *
 * Adapté du StatsRadarChart tennis avec :
 *  - Couleurs FotMob : #00d77e (home), #6aa6d0 (away)
 *  - Labels football
 *  - Données RadarMatchData (home/away)
 */

// ---------------------------------------------------------------------------
// Couleurs FotMob
// ---------------------------------------------------------------------------

const COLOR_HOME = "#00d77e"; // FotMob green
const COLOR_AWAY = "#6aa6d0"; // FotMob blue

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RadarDatum = {
  axis: string;
  axisKey: RadarAxisKey;
  home: number;
  away: number;
};

export interface FootballRadarChartProps {
  data: RadarMatchData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FootballRadarChart({ data, className }: FootballRadarChartProps) {
  const chartData = useMemo<RadarDatum[]>(() => {
    return RADAR_AXIS_ORDER.map((key) => ({
      axis: RADAR_AXIS_LABELS[key],
      axisKey: key,
      home: Math.round(data.home[key]),
      away: Math.round(data.away[key]),
    }));
  }, [data]);

  return (
    <div
      className={cn("flex w-full flex-col items-center gap-1", className)}
      role="img"
      aria-label={`Radar comparatif ${data.homeName} vs ${data.awayName}`}
    >
      <ResponsiveContainer width="100%" height={220} minHeight={200}>
        <RadarChart
          data={chartData}
          outerRadius="70%"
          margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
        >
          <PolarGrid
            stroke="#e0e0e0"
            strokeOpacity={0.6}
            strokeWidth={0.5}
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={({ x, y, payload }) => {
              const d = chartData.find((dd) => dd.axis === payload?.value);
              const val = d ? `${d.home.toFixed(0)} / ${d.away.toFixed(0)}` : "";
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fontSize={10}
                    fill="#717171"
                  >
                    {payload?.value}
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    dy={11}
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="var(--font-geist-mono)"
                    fill="#222222"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {val}
                  </text>
                </g>
              );
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
            cursor={{ stroke: "#e0e0e0", strokeOpacity: 0.4 }}
          />
          <Radar
            name={data.homeName}
            dataKey="home"
            stroke={COLOR_HOME}
            strokeWidth={1.5}
            fill={COLOR_HOME}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Radar
            name={data.awayName}
            dataKey="away"
            stroke={COLOR_AWAY}
            strokeWidth={1.5}
            fill={COLOR_AWAY}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <LegendItem color={COLOR_HOME} name={data.homeName} />
        <LegendItem color={COLOR_AWAY} name={data.awayName} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LegendItem({ color, name }: { color: string; name: string }) {
  const init = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="font-mono text-[11px] font-semibold tabular-nums shrink-0"
        style={{ color }}
      >
        {init}
      </span>
      <span className="truncate" style={{ color: "#717171" }}>
        {name}
      </span>
    </div>
  );
}

function RadarTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const axisLabel = payload[0]?.payload?.axis ?? "";
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1 text-xs leading-tight" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
      <div className="font-semibold" style={{ color: "#222" }}>{axisLabel}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ color: "#717171" }}>{entry.name}</span>
          <span className="font-mono font-medium tabular-nums" style={{ color: "#222" }}>
            {typeof entry.value === "number" ? entry.value.toFixed(0) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}
