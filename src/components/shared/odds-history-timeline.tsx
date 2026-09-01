"use client";

import { useMemo } from "react";
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

export type OddsHistoryPoint = {
  /** Timestamp ISO ou label */
  time: string;
  /** Odds A (decimal) */
  oddsA: number;
  /** Odds B (decimal) */
  oddsB: number;
};

type Props = {
  data: OddsHistoryPoint[];
  player1Name: string;
  player2Name: string;
  player1Color?: string;
  player2Color?: string;
  className?: string;
};

/**
 * Timeline d'historique des odds — AreaChart avec double ligne (A/B).
 * Affiche l'évolution des odds sur la durée d'un match ou d'une session.
 *
 * Conception Tufte :
 * - Pas de grid superflue, juste une ReferenceLine au centre (1.0 = even money)
 * - Direct labeling: noms des joueurs dans le header, pas dans une légende
 * - Tooltip minimaliste avec timestamp + valeur
 */
export function OddsHistoryTimeline({
  data,
  player1Name,
  player2Name,
  player1Color = "#00e676",
  player2Color = "#ff6b6b",
  className,
}: Props) {
  const gradientIdA = "oddsTimelineGradA";
  const gradientIdB = "oddsTimelineGradB";

  const tooltipFormatter = useMemo(
    () => (value: number, name: string) => [
      `${value.toFixed(2)}`,
      name === "oddsA" ? player1Name : player2Name,
    ],
    [player1Name, player2Name],
  );

  const labelFormatter = useMemo(
    () => (label: string) => {
      try {
        return new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(label));
      } catch {
        return label;
      }
    },
    [],
  );

  if (data.length < 2) {
    return (
      <div className={cn("flex h-[120px] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground", className)}>
        Pas encore de données d&apos;odds
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <header className="mb-1.5 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Historique des odds
        </h4>
        <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums">
          <span style={{ color: player1Color }}>
            {player1Name} {data[data.length - 1]?.oddsA.toFixed(2)}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span style={{ color: player2Color }}>
            {player2Name} {data[data.length - 1]?.oddsB.toFixed(2)}
          </span>
        </div>
      </header>

      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientIdA} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={player1Color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={player1Color} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id={gradientIdB} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={player2Color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={player2Color} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              hide
            />
            <YAxis hide />

            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "11px",
                padding: "4px 8px",
              }}
              labelFormatter={labelFormatter}
              formatter={tooltipFormatter}
            />

            <Area
              type="monotone"
              dataKey="oddsA"
              stroke={player1Color}
              strokeWidth={1.5}
              fill={`url(#${gradientIdA})`}
              isAnimationActive={false}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="oddsB"
              stroke={player2Color}
              strokeWidth={1.5}
              fill={`url(#${gradientIdB})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
