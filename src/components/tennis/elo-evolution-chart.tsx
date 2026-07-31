"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type EloDataPoint = {
  date: string;
  elo: number;
  event?: string;
};

type EloEvolutionChartProps = {
  playerName: string;
  data: EloDataPoint[];
  color?: string;
  className?: string;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonth(iso: string): string {
  const [, m] = iso.split("-");
  const monthIdx = Number(m) - 1;
  return MONTH_NAMES[monthIdx] ?? m;
}

function formatDateLong(iso: string): string {
  const date = new Date(iso + "T00:00:00");
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function EloTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EloDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDateLong(point.date)}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
        Elo {point.elo}
      </p>
      {point.event && (
        <p className="mt-0.5 max-w-[180px] text-[11px] leading-tight text-muted-foreground">
          {point.event}
        </p>
      )}
    </div>
  );
}

export function EloEvolutionChart({
  playerName,
  data,
  color = "#10B981",
  className,
}: EloEvolutionChartProps) {
  const gradientId = React.useId();

  const eloValues = data.map((d) => d.elo);
  const eloMin = eloValues.length ? Math.min(...eloValues) : 1400;
  const eloMax = eloValues.length ? Math.max(...eloValues) : 1600;
  const padding = Math.max(20, Math.round((eloMax - eloMin) * 0.15));
  const yDomain: [number, number] = [
    Math.floor((eloMin - padding) / 10) * 10,
    Math.ceil((eloMax + padding) / 10) * 10,
  ];

  const eventIndices = data
    .map((d, i) => (d.event ? i : -1))
    .filter((i) => i !== -1);

  const ariaLabel =
    data.length === 0
      ? `Elo evolution chart for ${playerName} — no data available`
      : `Elo evolution chart for ${playerName}. ` +
        `Started at ${data[0].elo}, currently at ${data[data.length - 1].elo}. ` +
        `${eventIndices.length} event${eventIndices.length === 1 ? "" : "s"} annotated.`;

  if (!data.length) {
    return (
      <div
        className={cn(
          "flex h-[200px] w-full items-center justify-center rounded-md bg-muted/20",
          className,
        )}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[120px] w-[80%] rounded-md" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} role="img" aria-label={ariaLabel}>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgb(255 255 255 / 0.05)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatMonth}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgb(255 255 255 / 0.6)", fontSize: 11, fontFamily: "inherit" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgb(255 255 255 / 0.6)", fontSize: 11, fontFamily: "inherit" }}
              width={40}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) * 100}` : String(v))}
            />

            <Tooltip
              content={<EloTooltip />}
              cursor={{ stroke: "rgb(255 255 255 / 0.15)", strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="elo"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{
                r: 4,
                fill: color,
                stroke: "rgb(255 255 255 / 0.9)",
                strokeWidth: 1.5,
              }}
            />

            {eventIndices.map((i) => {
              const pt = data[i];
              return (
                <ReferenceDot
                  key={`event-${i}`}
                  x={pt.date}
                  y={pt.elo}
                  r={4}
                  fill={color}
                  stroke="rgb(255 255 255 / 0.85)"
                  strokeWidth={1.5}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {eventIndices.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
          {eventIndices.map((i) => {
            const pt = data[i];
            return (
              <span
                key={`legend-${i}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {pt.event}
                {" — "}
                <span className="font-mono tabular-nums text-foreground/80">{pt.elo}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
