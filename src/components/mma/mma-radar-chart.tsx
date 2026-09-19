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

/**
 * MmaRadarChart — radar comparison 2 fighters sur 6 axes MMA.
 *
 * Axes:
 *   1. Striking    → sig strike accuracy %     (0-100)
 *   2. Takedowns   → TD accuracy %             (0-100)
 *   3. TD Defense  → TD defense %              (0-100)
 *   4. Ground      → ground control time avg   (0-5 → 0-100)
 *   5. Submissions → sub attempts avg          (0-3 → 0-100)
 *   6. Finishes    → career finish rate %       (0-100)
 */

const COLOR_A = "#7B3FA0";
const COLOR_B = "#4DABF7";

export interface MmaRadarData {
  striking: number;
  takedowns: number;
  tdDefense: number;
  ground: number;
  submissions: number;
  finishes: number;
}

type Props = {
  dataA: MmaRadarData;
  dataB?: MmaRadarData;
  fighterA: string;
  fighterB: string;
  colorA?: string;
  colorB?: string;
  className?: string;
};

type RadarDatum = {
  axis: string;
  fighterA: number;
  fighterB: number;
};

function clamp(v: number, max: number): number {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, (v / max) * 100));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AXES = [
  { key: "striking", label: "Striking", max: 100 },
  { key: "takedowns", label: "Takedowns", max: 100 },
  { key: "tdDefense", label: "TD Defense", max: 100 },
  { key: "ground", label: "Ground", max: 5 },
  { key: "submissions", label: "Submissions", max: 3 },
  { key: "finishes", label: "Finishes", max: 100 },
] as const;

export function MmaRadarChart({
  dataA,
  dataB,
  fighterA,
  fighterB,
  colorA = COLOR_A,
  colorB = COLOR_B,
  className,
}: Props) {
  const hasB = dataB != null;

  const data = useMemo<RadarDatum[]>(
    () =>
      AXES.map((ax) => ({
        axis: ax.label,
        fighterA: clamp(dataA[ax.key] ?? 0, ax.max),
        fighterB: hasB
          ? clamp(dataB![ax.key] ?? 0, ax.max)
          : 0,
      })),
    [dataA, dataB, hasB]
  );

  return (
    <div
      className={cn("flex w-full flex-col items-center gap-2", className)}
      role="img"
      aria-label={`Radar comparant ${fighterA} et ${fighterB}`}
    >
      <span className="sr-only">
        Radar comparant les stats de {fighterA} et {fighterB}
      </span>

      <ResponsiveContainer width="100%" height={220} minHeight={200}>
        <RadarChart
          data={data}
          outerRadius="70%"
          margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
        >
          <PolarGrid
            stroke="hsl(var(--border, 215 16% 80%))"
            strokeOpacity={0.5}
            strokeWidth={0.5}
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={({ x, y, payload }) => {
              const d = data.find((dd) => dd.axis === payload?.value);
              const val = d
                ? hasB
                  ? `${d.fighterA.toFixed(0)} / ${d.fighterB.toFixed(0)}`
                  : `${d.fighterA.toFixed(0)}`
                : "";
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fontSize={10}
                    fill="hsl(var(--muted-foreground, 215 14% 50%))"
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
                    fill="hsl(var(--foreground, 0 0% 98%))"
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
          <Tooltip content={<MmaTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeOpacity: 0.4 }} />
          <Radar
            name={fighterA}
            dataKey="fighterA"
            stroke={colorA}
            strokeWidth={1.5}
            fill={colorA}
            fillOpacity={0.15}
            isAnimationActive={false}
          />
          {hasB && (
            <Radar
              name={fighterB}
              dataKey="fighterB"
              stroke={colorB}
              strokeWidth={1.5}
              fill={colorB}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>

      <div className="flex w-full items-center justify-center gap-4 text-xs" role="list">
        <LegendItem color={colorA} name={fighterA} />
        {hasB && <LegendItem color={colorB} name={fighterB} />}
      </div>
    </div>
  );
}

function LegendItem({ color, name }: { color: string; name: string }) {
  return (
    <div role="listitem" className="flex items-center gap-1.5 min-w-0">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-[11px] font-semibold tabular-nums shrink-0" style={{ color }}>
        {initials(name)}
      </span>
      <span className="truncate text-muted-foreground">{name}</span>
    </div>
  );
}

function MmaTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const axisLabel = payload[0]?.payload?.axis ?? "";
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1 text-xs leading-tight">
      <div className="font-medium text-foreground">{axisLabel}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-1.5">
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
