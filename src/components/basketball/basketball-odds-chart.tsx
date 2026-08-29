"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { OddsSnapshot } from "@/lib/basketball-odds";

type Props = {
  snapshots: OddsSnapshot[];
  homeName: string;
  awayName: string;
};

export function BasketballOddsChart({ snapshots, homeName, awayName }: Props) {
  const data = useMemo(() => {
    return snapshots.map((s) => ({
      time: new Date(s.timestamp).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      homeML: s.mlHome,
      awayML: s.mlAway,
      homeProb: s.impliedHome,
      awayProb: s.impliedAway,
      spread: s.spreadHome,
      total: s.total,
    }));
  }, [snapshots]);

  if (data.length === 0) return null;

  // Déterminer si le spread est positif ou négatif
  const currentSpread = data[data.length - 1]?.spread;
  const currentTotal = data[data.length - 1]?.total;

  return (
    <div className="space-y-3">
      {/* Moneyline movement */}
      <div>
        <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
          Moneyline Movement
        </h4>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                domain={["dataMin - 50", "dataMax + 50"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                dataKey="homeML"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={homeName}
              />
              <Line
                type="monotone"
                dataKey="awayML"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name={awayName}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs mt-1">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {homeName}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {awayName}
          </span>
        </div>
      </div>

      {/* Implied probability movement */}
      <div>
        <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
          Implied Probability
        </h4>
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
                formatter={(value: number) => [`${value}%`]}
              />
              <Line
                type="monotone"
                dataKey="homeProb"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={homeName}
              />
              <Line
                type="monotone"
                dataKey="awayProb"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name={awayName}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current line summary */}
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {currentSpread != null && (
          <div className="rounded bg-muted/50 p-1.5">
            <span className="text-muted-foreground">Spread</span>
            <div className="font-semibold">
              {homeName} {currentSpread > 0 ? "+" : ""}{currentSpread}
            </div>
          </div>
        )}
        {currentTotal != null && (
          <div className="rounded bg-muted/50 p-1.5">
            <span className="text-muted-foreground">Total</span>
            <div className="font-semibold">O/U {currentTotal}</div>
          </div>
        )}
        <div className="rounded bg-muted/50 p-1.5">
          <span className="text-muted-foreground">Snapshots</span>
          <div className="font-semibold">{data.length}</div>
        </div>
      </div>
    </div>
  );
}
