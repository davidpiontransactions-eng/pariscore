"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useFibaScoreboard } from "@/hooks/use-fiba-scoreboard";
import { FibaGameCard } from "./fiba-game-card";
import { FibaStandings } from "./fiba-standings";
import { PredictionPanel } from "./prediction-panel";
import { BacktestPanel } from "./backtest-panel";
import { FibaErrorBoundary } from "./fiba-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { predictMatch } from "@/lib/predictions/fiba-predictions";
import { useFibaStats } from "@/hooks/use-fiba-stats";
import type { FibaMatch } from "@/app/api/fiba/scoreboard/route";

type FibaScoreboardProps = {
  className?: string;
  onMatchClick?: (match: FibaMatch) => void;
};

type TabView = "live" | "schedule" | "standings" | "backtest";

function ScoreboardSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-3">
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-sm" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-4 w-8" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-sm" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function FibaScoreboard({ className, onMatchClick }: FibaScoreboardProps) {
  const [activeTab, setActiveTab] = useState<TabView>("live");
  const [selectedMatch, setSelectedMatch] = useState<FibaMatch | null>(null);
  const { matches, liveMatches, preMatches, postMatches, isLoading, error } = useFibaScoreboard();
  const { statsByAbbr } = useFibaStats();

  const tabs = useMemo(() => [
    { id: "live" as const, label: "En direct", count: liveMatches.length },
    { id: "schedule" as const, label: "Calendrier", count: preMatches.length },
    { id: "standings" as const, label: "Classements", count: 0 },
    { id: "backtest" as const, label: "Backtest & Value", count: 0 },
  ], [liveMatches.length, preMatches.length]);

  const displayedMatches = useMemo(() => {
    switch (activeTab) {
      case "live": return [...liveMatches, ...postMatches];
      case "schedule": return [...preMatches, ...postMatches];
      default: return [];
    }
  }, [activeTab, liveMatches, preMatches, postMatches]);

  // Grouper par groupe
  const grouped = useMemo(() => {
    const map = new Map<string, FibaMatch[]>();
    for (const m of displayedMatches) {
      const key = m.group || "Autre";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [displayedMatches]);

  if (error) {
    return (
      <div className={cn("rounded-xl border bg-destructive/10 p-6 text-center", className)}>
        <p className="text-sm text-destructive font-medium">Erreur chargement FIBA</p>
        <p className="text-xs text-muted-foreground mt-1">{String(error)}</p>
      </div>
    );
  }

  return (
    <FibaErrorBoundary>
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">FIBA Women&apos;s WC 2026</h2>
          {liveMatches.length > 0 && (
            <Badge variant="default" className="bg-emerald-500 text-[10px] animate-pulse">
              {liveMatches.length} LIVE
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-muted p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-0.5 rounded-full bg-muted-foreground/20 px-1 py-0 text-[9px] tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <ScoreboardSkeleton />
      ) : activeTab === "standings" ? (
        <FibaStandings />
      ) : activeTab === "backtest" ? (
        <BacktestPanel />
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {activeTab === "live"
              ? "Aucun match en cours"
              : "Aucun match à venir"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([group, groupMatches]) => (
            <div key={group}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {group === "Autre" ? "FIBA" : `Groupe ${group}`}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groupMatches.map((match) => (
                  <FibaGameCard
                    key={match.id}
                    match={match}
                    onClick={(m) => {
                      setSelectedMatch(m);
                      onMatchClick?.(m);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prediction Panel (shown when match selected) */}
      {selectedMatch && (() => {
        const homeStats = statsByAbbr.get(selectedMatch.home.abbr);
        const awayStats = statsByAbbr.get(selectedMatch.away.abbr);
        const prediction = predictMatch({
          homeTeam: selectedMatch.home.abbr,
          awayTeam: selectedMatch.away.abbr,
          isHome: true,
          homeStats: homeStats ? {
            eFG: homeStats.eFG,
            TOV: homeStats.TOV,
            dREB: homeStats.rpg,
            FT: homeStats.FT,
            offensiveRating: homeStats.ORtg,
            defensiveRating: homeStats.DRtg,
            pace: homeStats.pace,
            trueShooting: homeStats.trueShooting,
            assistTurnoverRatio: homeStats.assistTurnoverRatio,
            benchPoints: homeStats.benchPoints,
            pointsInPaint: homeStats.pointsInPaint,
            fastBreakPoints: homeStats.fastBreakPoints,
          } : undefined,
          awayStats: awayStats ? {
            eFG: awayStats.eFG,
            TOV: awayStats.TOV,
            dREB: awayStats.rpg,
            FT: awayStats.FT,
            offensiveRating: awayStats.ORtg,
            defensiveRating: awayStats.DRtg,
            pace: awayStats.pace,
            trueShooting: awayStats.trueShooting,
            assistTurnoverRatio: awayStats.assistTurnoverRatio,
            benchPoints: awayStats.benchPoints,
            pointsInPaint: awayStats.pointsInPaint,
            fastBreakPoints: awayStats.fastBreakPoints,
          } : undefined,
        });

        return (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">
                Prédiction: {selectedMatch.home.abbr} vs {selectedMatch.away.abbr}
              </h3>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Fermer
              </button>
            </div>
            <PredictionPanel
              prediction={prediction}
              homeAbbr={selectedMatch.home.abbr}
              awayAbbr={selectedMatch.away.abbr}
              homeName={selectedMatch.home.name}
              awayName={selectedMatch.away.name}
            />
          </div>
        );
      })()}
    </div>
    </FibaErrorBoundary>
  );
}
