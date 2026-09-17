"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

type Snapshot = {
  matchId: string;
  bookmaker: string;
  market: string;
  outcome: string;
  odds: number;
  impliedProb: number;
  scrapedAt: string;
};

type ArchiveResponse = {
  total: number;
  matches: number;
  snapshots: Snapshot[];
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const OUTCOME_COLORS: Record<string, string> = {
  H: "#10b981", // emerald-500
  D: "#f59e0b", // amber-500
  A: "#3b82f6", // blue-500
  O: "#8b5cf6", // violet-500
  U: "#6b7280", // gray-500
  Yes: "#ec4899", // pink-500
  No: "#64748b", // slate-500
};

const OUTCOME_LABELS: Record<string, string> = {
  H: "Domicile",
  D: "Nul",
  A: "Extérieur",
  O: "Over 2.5",
  U: "Under 2.5",
  Yes: "BTTS Oui",
  No: "BTTS Non",
};

export function OddsHistoryChart({
  matchId,
  market = "1X2",
}: {
  matchId: string;
  market?: string;
}) {
  const { data, isLoading } = useSWR<ArchiveResponse>(
    matchId ? `/api/v1/odds-archive?matchId=${encodeURIComponent(matchId)}&market=${market}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { chartData, outcomes } = useMemo(() => {
    if (!data?.snapshots?.length) return { chartData: [], outcomes: [] as string[] };

    // Grouper par timestamp
    const timeMap = new Map<string, Record<string, number | string>>();
    const allOutcomes = new Set<string>();

    for (const s of data.snapshots) {
      const ts = new Date(s.scrapedAt).toISOString();
      const entry = timeMap.get(ts) ?? { ts };
      entry[s.outcome] = s.odds;
      timeMap.set(ts, entry);
      allOutcomes.add(s.outcome);
    }

    const sorted = [...timeMap.values()].sort(
      (a, b) => new Date(a.ts as string).getTime() - new Date(b.ts as string).getTime(),
    );

    return { chartData: sorted, outcomes: [...allOutcomes] };
  }, [data]);

  if (isLoading) return <Skeleton className="h-56 w-full rounded-xl" />;

  if (chartData.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        <span>Pas d&apos;historique odds pour ce match</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">Historique odds — {market}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {outcomes.map((o) => (
            <span key={o} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: OUTCOME_COLORS[o] ?? "#94a3b8" }}
              />
              <span className="text-muted-foreground">{OUTCOME_LABELS[o] ?? o}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              {outcomes.map((o) => (
                <linearGradient key={o} id={`grad-${o}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={OUTCOME_COLORS[o] ?? "#94a3b8"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={OUTCOME_COLORS[o] ?? "#94a3b8"} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="ts"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
              }}
              tick={{ fontSize: 10, fill: "#9e9e9e" }}
              stroke="#e5e5e5"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9e9e9e" }}
              stroke="#e5e5e5"
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as Record<string, unknown>;
                const ts = new Date(d.ts as string);
                return (
                  <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg dark:bg-card">
                    <p className="mb-1 font-medium">
                      {ts.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {payload.map((p) => (
                      <p key={p.dataKey as string} style={{ color: p.color }}>
                        {OUTCOME_LABELS[p.dataKey as string] ?? p.dataKey}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
                      </p>
                    ))}
                  </div>
                );
              }}
              cursor={{ stroke: "#d4d4d8", strokeWidth: 1 }}
            />
            {outcomes.map((o) => (
              <Area
                key={o}
                type="monotone"
                dataKey={o}
                stroke={OUTCOME_COLORS[o] ?? "#94a3b8"}
                fill={`url(#grad-${o})`}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        {data?.total} snapshots · {chartData.length} points temporels · source BSD compare
      </p>
    </div>
  );
}
