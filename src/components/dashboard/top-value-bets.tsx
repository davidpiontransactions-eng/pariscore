"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { Skeleton } from "@/components/ui/skeleton";
import type { TennisMatch } from "@/lib/tennis-data";
import { computeKellyStake, KELLY_FRACTION_CAP } from "@/lib/kelly";

type ValueBetItem = {
  id: string; sport: string; match: string;
  edge: number; odds: number; bookmaker: string; playerName: string;
  kelly: number; kellyCapped: boolean;
};

type TopValueBetsListProps = { className?: string };

const SPORT_EMOJI: Record<string, string> = { tennis: "🎾", football: "⚽", mma: "🥊" };

function computeEdge(match: TennisMatch): ValueBetItem[] {
  const items: ValueBetItem[] = [];
  if (!match.allOdds || match.allOdds.length === 0) return items;
  for (const odd of match.allOdds) {
    const edgeA = match.probA - odd.impliedProbA;
    const edgeB = match.probB - odd.impliedProbB;
    if (edgeA > 0) {
      const kelly = computeKellyStake(match.probA, odd.decimalA);
      items.push({
        id: `${match.id}-${odd.bookmaker}-A`, sport: "tennis",
        match: `${match.playerA.shortName} vs ${match.playerB.shortName}`,
        edge: Math.round(edgeA * 10) / 10, odds: odd.decimalA,
        bookmaker: odd.bookmaker, playerName: match.playerA.shortName,
        kelly: kelly.pct, kellyCapped: kelly.capped,
      });
    }
    if (edgeB > 0) {
      const kelly = computeKellyStake(match.probB, odd.decimalB);
      items.push({
        id: `${match.id}-${odd.bookmaker}-B`, sport: "tennis",
        match: `${match.playerA.shortName} vs ${match.playerB.shortName}`,
        edge: Math.round(edgeB * 10) / 10, odds: odd.decimalB,
        bookmaker: odd.bookmaker, playerName: match.playerB.shortName,
        kelly: kelly.pct, kellyCapped: kelly.capped,
      });
    }
  }
  return items;
}

function TopValueBetsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4" /></div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TopValueBetsList({ className }: TopValueBetsListProps) {
  const { data, isLoading, error } = usePrematchMatches();

  const valueBets = useMemo(() => {
    // Mode dégradé (mock local / cache périmé) : les cotes ne sont pas
    // réelles — ne JAMAIS présenter d'edges comme des value bets.
    if (data?.source === "mock" || data?.source === "cache-stale" || data?.source === "error") return [];
    if (!data?.matches) return [];
    const all: ValueBetItem[] = [];
    for (const match of data.matches) all.push(...computeEdge(match));
    return all.sort((a, b) => b.edge - a.edge).slice(0, 10);
  }, [data?.matches]);

  const header = (
    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
      🔥 TOP VALUE BETS
    </h3>
  );

  if (isLoading) {
    return <div className={cn("flex flex-col gap-3", className)}>{header}<TopValueBetsSkeleton /></div>;
  }

  if (error && !data) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {header}
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Données temporairement indisponibles
        </div>
      </div>
    );
  }

  if (valueBets.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {header}
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun value bet détecté pour le moment
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {header}
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {valueBets.map((bet) => (
          <div key={bet.id} className={cn(
            "flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3",
            "hover:border-emerald-500/40 transition-colors",
          )}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{SPORT_EMOJI[bet.sport] ?? "📌"}</span>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{bet.match}</span>
                  <span className="text-[11px] text-muted-foreground">{bet.playerName} @ {bet.odds}</span>
                </div>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
              +{bet.edge}% edge
            </span>
            <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0" title={`Mise Kelly fractionnel (cap ${KELLY_FRACTION_CAP * 100}%)`}>
              Kelly {bet.kellyCapped ? "≥" : ""}{bet.kelly.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{bet.bookmaker}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
