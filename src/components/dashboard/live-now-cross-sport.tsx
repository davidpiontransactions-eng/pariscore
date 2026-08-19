"use client";

import { cn } from "@/lib/utils";
import { useLiveMatches, type LiveMatchState } from "@/hooks/use-live-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { Skeleton } from "@/components/ui/skeleton";
import type { FootballMatch } from "@/lib/football-data";

type LiveNowCrossSportProps = { className?: string };

const SPORT_EMOJI: Record<string, string> = {
  tennis: "🎾", football: "⚽", mma: "🥊",
};

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-rose-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
    </span>
  );
}

function formatSetScore(state: LiveMatchState): string {
  const sets = state.scoreA.sets.map((s, i) => {
    const b = state.scoreB.sets[i] ?? 0;
    return `${s}-${b}`;
  }).join(", ");
  if (sets.length === 0) return `${state.scoreA.games}-${state.scoreB.games}`;
  return `${sets}, ${state.scoreA.games}-${state.scoreB.games}${state.server === "A" ? "*" : state.server === "B" ? "" : ""}`;
}

function formatFootballScore(m: FootballMatch): string {
  if (m.live) return `${m.live.homeScore}-${m.live.awayScore}`;
  return "-";
}

function formatFootballTime(m: FootballMatch): string {
  if (!m.live) return "";
  if (m.live.status === "HT") return "Mi-temps";
  if (m.live.status === "FT") return "Terminé";
  return `${m.live.minute}'`;
}

function LiveSkeleton() {
  return (
    <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="shrink-0 rounded-xl border border-border/60 bg-card p-3 min-w-[200px]">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

export function LiveNowCrossSport({ className }: LiveNowCrossSportProps) {
  const { liveMatchList, liveStates } = useLiveMatches();
  const { data: footData, isLoading: footLoading } = useFootballMatches();

  // Collect live items
  const liveItems: { sport: string; match: string; score: string; time: string; key: string }[] = [];

  // Tennis live
  for (const m of liveMatchList) {
    const state = liveStates[m.id];
    if (!state?.isLive) continue;
    liveItems.push({
      sport: "tennis",
      match: `${m.playerA.name} vs ${m.playerB.name}`,
      score: formatSetScore(state),
      time: `Set ${state.currentSet}`,
      key: `tennis-${m.id}`,
    });
  }

  // Football live
  const footLive = (footData?.matches ?? []).filter((m) => !!m.live && m.live.status !== "FT");
  for (const m of footLive) {
    liveItems.push({
      sport: "football",
      match: `${m.home.shortName} vs ${m.away.shortName}`,
      score: formatFootballScore(m),
      time: formatFootballTime(m),
      key: `foot-${m.id}`,
    });
  }

  const isLoading = liveMatchList.length === 0 && footLoading;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <LiveDot />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">⚡ EN DIRECT</h2>
        {liveItems.length > 0 && (
          <span className="text-xs text-muted-foreground">({liveItems.length})</span>
        )}
      </div>

      {isLoading && <LiveSkeleton />}

      {!isLoading && liveItems.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun match en direct actuellement
        </div>
      )}

      {!isLoading && liveItems.length > 0 && (
        <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-1 snap-x snap-mandatory scrollbar-none" role="list">
          {liveItems.map((item) => (
            <div key={item.key} role="listitem" className={cn(
              "flex shrink-0 snap-start flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 min-w-[200px]",
              "transition-colors hover:border-rose-500/30 hover:bg-card/80",
            )}>
              <div className="flex items-center justify-between">
                <span className="text-lg">{SPORT_EMOJI[item.sport] ?? "🏆"}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <LiveDot /> LIVE
                </span>
              </div>
              <p className="text-sm font-semibold leading-tight text-foreground">{item.match}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-black tabular-nums text-foreground">{item.score}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
