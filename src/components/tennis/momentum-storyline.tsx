"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetData = {
  setNumber: number;
  winner: "A" | "B" | null;
  score: string;
  points: Array<{
    pointIndex: number;
    momentumA: number;
    event?: string;
  }>;
};

type Props = {
  sets: SetData[];
  playerAName: string;
  playerBName: string;
  isLive?: boolean;
  className?: string;
};

// ---------------------------------------------------------------------------
// Flatten helpers
// ---------------------------------------------------------------------------

type ChartRow = {
  globalIndex: number;
  set: number;
  pointIndex: number;
  momentumA: number;
  momentumB: number;
  event?: string;
};

function flattenPoints(sets: SetData[]): ChartRow[] {
  let global = 0;
  const rows: ChartRow[] = [];
  for (const set of sets) {
    for (const pt of set.points) {
      rows.push({
        globalIndex: global++,
        set: set.setNumber,
        pointIndex: pt.pointIndex,
        momentumA: pt.momentumA,
        momentumB: 1 - pt.momentumA,
        event: pt.event,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Event emoji map
// ---------------------------------------------------------------------------

const EVENT_STYLES: Record<string, { emoji: string; label: string }> = {
  break: { emoji: "💥", label: "Break" },
  ace: { emoji: "🎯", label: "Ace" },
  "double-fault": { emoji: "❌", label: "DF" },
  "set-point": { emoji: "🏁", label: "Set point" },
  "match-point": { emoji: "🏆", label: "Match point" },
  "break-point": { emoji: "⚠️", label: "Break point" },
  winner: { emoji: "⚡", label: "Winner" },
  "long-rally": { emoji: "🔄", label: "Rally" },
};

function resolveEvent(key: string): { emoji: string; label: string } {
  return EVENT_STYLES[key] ?? { emoji: "📌", label: key };
}


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SetScoresRow({ sets }: { sets: SetData[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
      {sets.map((s, i) => (
        <span key={s.setNumber} className="inline-flex items-center gap-1">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground/70">
            Set {s.setNumber}
          </span>
          <span className="text-foreground/80">{s.score}</span>
          {s.winner && (
            <span
              className={cn(
                "rounded-sm px-1 py-px text-[10px] font-bold",
                s.winner === "A"
                  ? "bg-[#10B981]/15 text-[#10B981]"
                  : "bg-[#EF4444]/15 text-[#EF4444]",
              )}
            >
              {s.winner === "A" ? "A" : "B"}
            </span>
          )}
          {i < sets.length - 1 && (
            <span className="text-muted-foreground/30">|</span>
          )}
        </span>
      ))}
    </div>
  );
}

function EventPills({
  events,
}: {
  events: Array<{ globalIndex: number; event: string; set: number }>;
}) {
  if (!events.length) return null;

  const resolved = events
    .slice(0, 5)
    .map((e) => ({ ...e, ...resolveEvent(e.event) }));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {resolved.map((ev, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] leading-none text-muted-foreground"
          title={`Set ${ev.set} · Point ${ev.globalIndex + 1}: ${ev.label}`}
        >
          <span className="text-xs">{ev.emoji}</span>
          <span>{ev.label}</span>
          <span className="text-muted-foreground/40">S{ev.set}</span>
        </span>
      ))}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative ml-2 inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-[#10B981] opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function MomentumStoryline({
  sets,
  playerAName,
  playerBName,
  isLive = false,
  className,
}: Props) {
  const chartData = useMemo(() => flattenPoints(sets), [sets]);

  const events = useMemo(
    () =>
      chartData
        .filter((d) => d.event)
        .map((d) => ({
          globalIndex: d.globalIndex,
          event: d.event!,
          set: d.set,
        })),
    [chartData],
  );

  const playerAShort =
    playerAName.split(" ").slice(-1)[0] ?? playerAName;
  const playerBShort =
    playerBName.split(" ").slice(-1)[0] ?? playerBName;

  const lastPt =
    chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const yAxisTickFormatter = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <section
      className={cn("w-full rounded-lg bg-card p-3", className)}
      aria-label={`Momentum storyline: ${playerAName} vs ${playerBName}`}
      role="img"
    >
      {/* Header row */}
      <header className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Momentum
          </h4>
          {isLive && <LiveDot />}
        </div>

        {lastPt && (
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="font-semibold text-[#10B981]">
              {playerAShort} {Math.round(lastPt.momentumA * 100)}%
            </span>
            <span className="text-muted-foreground/50">&middot;</span>
            <span className="font-semibold text-[#EF4444]">
              {playerBShort} {Math.round(lastPt.momentumB * 100)}%
            </span>
          </div>
        )}
      </header>

      {/* Set scores row */}
      <SetScoresRow sets={sets} />

      {/* Area chart */}
      {chartData.length < 2 ? (
        <div className="flex h-[200px] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground">
          Not enough points to chart
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient
                  id="momGradientA"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="momGradientB"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.25}
                vertical={false}
              />

              <XAxis
                dataKey="globalIndex"
                tick={{
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={[0, 1]}
                tick={{
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={yAxisTickFormatter}
                width={32}
              />

              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeOpacity: 0.3,
                }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "4px 8px",
                }}
                labelFormatter={(label) => `Point ${(label as number) + 1}`}
                formatter={(value: number, name: string) => {
                  const pct = `${Math.round(value * 100)}%`;
                  return name === "momentumA"
                    ? [pct, playerAShort]
                    : [pct, playerBShort];
                }}
              />

              <Area
                type="monotone"
                dataKey="momentumA"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#momGradientA)"
                isAnimationActive={false}
                dot={false}
                stackId={undefined}
              />

              <Area
                type="monotone"
                dataKey="momentumB"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#momGradientB)"
                isAnimationActive={false}
                dot={false}
                stackId={undefined}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Event annotations */}
      <EventPills events={events} />
    </section>
  );
}
