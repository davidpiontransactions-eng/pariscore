"use client";

import useSWR from "swr";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";

type TimingStat = {
  league: string;
  country: string;
  slug: string;
  over05_1hPct: number;
  lateGoalsPct: number;
  gamesPlayed: number;
};

type TimingResponse = {
  stats: TimingStat[];
  total: number;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export function LateDrama({ limit = 10 }: { limit?: number }) {
  const { data, isLoading } = useSWR<TimingResponse>(
    "/api/v1/leagues-stats/timing",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const sorted = (data?.stats ?? [])
    .sort((a, b) => b.lateGoalsPct - a.lateGoalsPct)
    .slice(0, limit);

  const maxPct = sorted.length > 0 ? Math.max(...sorted.map((s) => s.lateGoalsPct)) : 100;
  const minPct = sorted.length > 0 ? Math.min(...sorted.map((s) => s.lateGoalsPct)) : 0;
  const range = maxPct - minPct || 1;

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-rose-500" />
        <span className="text-sm font-semibold">Drame tardif</span>
        <span className="text-[11px] text-muted-foreground">% buts en 2ème mi-temps</span>
      </div>
      <div className="space-y-1.5">
        {sorted.map((s, i) => (
          <Link
            key={`${s.country}/${s.slug}`}
            href={`/ligues/${s.country}/${s.slug}`}
            className="group flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-accent/40"
          >
            <span className="w-5 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium group-hover:text-emerald-600">
              {s.league}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-rose-400 transition-all"
                  style={{ width: `${((s.lateGoalsPct - minPct) / range) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-bold tabular-nums">
                {s.lateGoalsPct}%
              </span>
            </div>
          </Link>
        ))}
      </div>
      {sorted.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Proxy: % buts marqués en 2ème MT (source OddAlerts halves)
        </p>
      )}
    </div>
  );
}
