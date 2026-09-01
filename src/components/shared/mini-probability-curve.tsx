"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

const MAX_HISTORY = 30;

type HistoryPoint = {
  tick: number;
  p1: number;
  p2: number;
};

type Props = {
  probA: number;
  probB: number;
  player1Name: string;
  player2Name: string;
  player1Color?: string;
  player2Color?: string;
  className?: string;
};

/**
 * Mini courbe de probabilité live — version compacte pour les cartes match.
 * Rolling buffer de 30 points, animation zéro (isAnimationActive={false}).
 * Affiche les labels P1/P2 en bas sans légende.
 */
export function MiniProbabilityCurve({
  probA,
  probB,
  player1Name,
  player2Name,
  player1Color = "#00e676",
  player2Color = "#ff6b6b",
  className,
}: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const tickRef = useRef(0);
  const lastProbRef = useRef<number | null>(null);
  const lastPlayerKey = useRef("");

  const playerKey = `${player1Name}|${player2Name}`;

  useEffect(() => {
    if (lastPlayerKey.current && lastPlayerKey.current !== playerKey) {
      setHistory([]);
      tickRef.current = 0;
      lastProbRef.current = null;
    }
    lastPlayerKey.current = playerKey;
  }, [playerKey]);

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

  const currentP1 = data.length ? data[data.length - 1].p1 : probA;
  const currentP2 = data.length ? data[data.length - 1].p2 : probB;

  const gradientId = "miniProbGradient";

  const tooltipFormatter = useMemo(
    () => (value: number) => [`${Math.round(value)}%`, ""],
    [],
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="h-[60px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 2, right: 2, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={player1Color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={player1Color} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            {hasEnoughData && (
              <Tooltip
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.2 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "4px",
                  fontSize: "10px",
                  padding: "2px 6px",
                }}
                labelFormatter={(label) => `#${label}`}
                formatter={tooltipFormatter}
              />
            )}

            <Area
              type="monotone"
              dataKey="p1"
              stroke={player1Color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Labels compacts */}
      <div className="flex items-center justify-between px-0.5 font-mono text-[9px] tabular-nums">
        <span style={{ color: player1Color }} className="font-semibold">
          {player1Name} {Math.round(currentP1)}%
        </span>
        <span style={{ color: player2Color }} className="font-semibold">
          {player2Name} {Math.round(currentP2)}%
        </span>
      </div>
    </div>
  );
}
