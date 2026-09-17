"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

type TeamCS = {
  team: string;
  csPct: number;
  gp: number;
  bttsPct: number | null;
  over25Pct: number | null;
};

type CSResponse = {
  teams: TeamCS[];
  total: number;
  league: string;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export function CleanSheetsWidget({
  country,
  slug,
  limit = 20,
}: {
  country: string;
  slug: string;
  limit?: number;
}) {
  const { data, isLoading } = useSWR<CSResponse>(
    `/api/v1/leagues-stats/${country}/${slug}/clean-sheets`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 },
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const teams = (data?.teams ?? []).slice(0, limit);
  if (teams.length === 0) return null;

  const maxPct = Math.max(...teams.map((t) => t.csPct));

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold">Clean Sheets</span>
        <span className="text-[11px] text-muted-foreground">% matchs sans encaisser</span>
      </div>
      <div className="space-y-1.5">
        {teams.map((t, i) => (
          <div
            key={t.team}
            className="flex items-center gap-2 rounded px-1.5 py-1"
          >
            <span className="w-5 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {t.team}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(t.csPct / maxPct) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-bold tabular-nums">
                {t.csPct}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {data?.total} équipes · source soccerstats.com
      </p>
    </div>
  );
}
