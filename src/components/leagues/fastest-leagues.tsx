"use client";

import useSWR from "swr";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";

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

export function FastestLeagues({ limit = 10 }: { limit?: number }) {
  const { data, isLoading } = useSWR<TimingResponse>(
    "/api/v1/leagues-stats/timing",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const sorted = (data?.stats ?? [])
    .sort((a, b) => b.over05_1hPct - a.over05_1hPct)
    .slice(0, limit);

  const maxPct = sorted.length > 0 ? sorted[0].over05_1hPct : 100;

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">Démarrages rapides</span>
        <span className="text-[11px] text-muted-foreground">% matchs avec but en 1ère MT</span>
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
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${(s.over05_1hPct / maxPct) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-bold tabular-nums">
                {s.over05_1hPct}%
              </span>
            </div>
          </Link>
        ))}
      </div>
      {sorted.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Proxy: % matchs avec ≥1 but en 1ère mi-temps (source OddAlerts halves)
        </p>
      )}
    </div>
  );
}
