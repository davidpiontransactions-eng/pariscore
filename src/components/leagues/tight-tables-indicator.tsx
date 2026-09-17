"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

type CompetitivenessData = {
  league: string;
  country: string;
  slug: string;
  homeWinPct: number;
  drawPct: number;
  gamesPlayed: number;
};

type CompetitivenessResponse = {
  stats: CompetitivenessData[];
  total: number;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export function TightTablesIndicator({ leagueSlug }: { leagueSlug?: string }) {
  const { data, isLoading } = useSWR<CompetitivenessResponse>(
    "/api/v1/leagues-stats/competitiveness",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (!data?.stats?.length) return null;

  // Si un slug est fourni, afficher juste cette ligue
  const stats = leagueSlug
    ? data.stats.filter((s) => s.slug === leagueSlug)
    : data.stats;

  if (stats.length === 0) return null;

  // Classement par compétitivité (draw% élevé = plus serré)
  const sorted = [...data.stats].sort((a, b) => b.drawPct - a.drawPct);
  const rankMap = new Map(sorted.map((s, i) => [s.slug, i + 1]));

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold">Compétitivité</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {stats.map((s) => {
          const rank = rankMap.get(s.slug) ?? 0;
          const total = sorted.length;
          const pctile = Math.round(((total - rank) / total) * 100);
          return (
            <div key={s.slug}>
              <p className="text-lg font-bold tabular-nums">{s.drawPct}%</p>
              <p className="text-[10px] text-muted-foreground">nuls</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {s.homeWinPct}% dom.
              </p>
              <p className="mt-1 text-[10px] font-medium text-blue-500">
                #{rank}/{total} ({pctile}e percentile)
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
