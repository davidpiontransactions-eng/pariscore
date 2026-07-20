"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * WinProbabilityChart — Live win-probability curve over the course of a match.
 *
 * Renders an area chart with the current P1 win probability (0-100%) tracked
 * point by point. The 50% line marks the even-money reference. Standard
 * in-play viz on Sofascore/Flashscore.
 *
 * Tufte principles applied:
 *   - Minimal chartjunk — no cartesian grid, no axes ticks beyond the 50% ref
 *   - Direct labeling: current P1/P2 values rendered next to the chart, not
 *     inside a legend
 *   - Single accent color (emerald) for P1; P2 is the implicit complement
 *   - Range-frame: Y axis bounded [0, 100], X axis is just the rolling window
 *
 * History strategy:
 *   The parent only passes the current `probA`/`probB`. The component keeps a
 *   rolling buffer (max 50 entries) so the curve grows over time. On unmount
 *   or match change (player name change used as proxy), the buffer resets.
 */

const MAX_HISTORY = 50;

type HistoryPoint = {
  /** Monotonic tick — index in the rolling buffer */
  tick: number;
  /** P1 win probability 0-100 */
  p1: number;
  /** P2 win probability 0-100 (= 100 - p1, kept for direct labeling) */
  p2: number;
};

type Props = {
  /** Current P1 win probability (0-100) */
  probA: number;
  /** Current P2 win probability (0-100) */
  probB: number;
  player1Name: string;
  player2Name: string;
  /** Override accent colors (defaults: P1 emerald, P2 rose) */
  player1Color?: string;
  player2Color?: string;
  className?: string;
};

export function WinProbabilityChart({
  probA,
  probB,
  player1Name,
  player2Name,
  player1Color = "#00e676",
  player2Color = "#ff6b6b",
  className,
}: Props) {
  const t = useTranslations("tennis");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const tickRef = useRef(0);
  const lastProbRef = useRef<number | null>(null);
  const lastPlayerKey = useRef<string>("");

  // Detect match change (player names changed) to reset history. This is a
  // heuristic — the parent should ideally key the component by matchId, but
  // this protects against accidental reuse across matches.
  const playerKey = `${player1Name}|${player2Name}`;

  useEffect(() => {
    if (lastPlayerKey.current && lastPlayerKey.current !== playerKey) {
      setHistory([]);
      tickRef.current = 0;
      lastProbRef.current = null;
    }
    lastPlayerKey.current = playerKey;
  }, [playerKey]);

  // Append to history only when probA actually changes — avoids dupes on
  // re-renders without real updates.
  useEffect(() => {
    if (lastProbRef.current === probA) return;
    lastProbRef.current = probA;
    tickRef.current += 1;
    setHistory((prev) => {
      const next = [...prev, { tick: tickRef.current, p1: probA, p2: probB }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, [probA, probB]);

  const data = history;
  const hasEnoughData = data.length >= 3;
  const isBalanced = Math.abs(probA - probB) <= 2;

  // Current values for the side labels
  const currentP1 = data.length ? data[data.length - 1].p1 : probA;
  const currentP2 = data.length ? data[data.length - 1].p2 : probB;

  const ariaLabel = t("winProbAria", {
    p1: player1Name,
    p1Prob: Math.round(currentP1),
    p2: player2Name,
    p2Prob: Math.round(currentP2),
    n: data.length,
  });

  // Stable gradient id (avoids SSR mismatch from useId — we use a static id)
  const gradientId = "winProbGradientP1";

  const tooltipFormatter = useMemo(
    () => (value: number) => [`${Math.round(value)}%`, ""],
    [],
  );

  return (
    <section
      className={cn("w-full", className)}
      aria-label={ariaLabel}
      role="img"
    >
      <header className="mb-1.5 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("winProbability")}
        </h4>
        <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
          <span style={{ color: player1Color }} className="font-semibold">
            {player1Name} {Math.round(currentP1)}%
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span style={{ color: player2Color }} className="font-semibold">
            {player2Name} {Math.round(currentP2)}%
          </span>
        </div>
      </header>

      {isBalanced && data.length < 5 ? (
        <div className="flex h-[100px] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground">
          {t("balanced")}
        </div>
      ) : (
        <div className="h-[100px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={player1Color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={player1Color} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <XAxis dataKey="tick" hide />
              <YAxis domain={[0, 100]} hide />

              <ReferenceLine
                y={50}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />

              {hasEnoughData && (
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "4px 8px",
                  }}
                  labelFormatter={(label) => `#${label}`}
                  formatter={tooltipFormatter}
                />
              )}

              <Area
                type="monotone"
                dataKey="p1"
                stroke={player1Color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
