"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { cn } from "@/lib/utils";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { filterByStartWindow, type MatchViewMode } from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { LeagueSelector } from "./basketball-league-selector";
import { BasketballMatchCard, BasketballMatchCardSkeleton } from "./basketball-match-card";
import { useBasketballMatches } from "@/hooks/use-basketball-matches";
import { useEuroLeagueMatches } from "@/hooks/use-euroleague-matches";
import type { BasketballLeagueId } from "@/lib/basketball-data";
import type { BasketballMatch } from "@/hooks/use-basketball-matches";
import dynamic from "next/dynamic";

const BasketballMatchDetailDialog = dynamic(
  () => import("./basketball-match-detail-dialog").then((m) => m.BasketballMatchDetailDialog),
  { ssr: false },
);

const BasketballH2H = dynamic(
  () => import("./basketball-h2h").then((m) => m.BasketballH2H),
  { ssr: false },
);

type BasketballTabContentProps = {
  className?: string;
};

/** Match unifié pour l'UI (source ESPN ou EuroLeague). */
type UnifiedMatch = {
  id: string;
  league: string;
  scheduledAt: string;
  status: string;
  home: { abbr: string; name: string; score: number | null; record: string | null };
  away: { abbr: string; name: string; score: number | null; record: string | null };
  pHome: number | null;
  pAway: number | null;
  edgeElo: number | null;
};

type PageView = "matchs" | "h2h";

export function BasketballTabContent({ className }: BasketballTabContentProps) {
  const [pageView, setPageView] = useState<PageView>("matchs");
  const [viewMode, setViewMode] = useState<MatchViewMode>("today");
  const [selectedLeagues, setSelectedLeagues] = useState<BasketballLeagueId[]>([
    "nba", "wnba", "euroleague", "eurocup",
  ]);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<BasketballMatch | null>(null);

  // Data fetching
  const { matches: nbaWnbaMatches, isLoading: nbaWnbaLoading, error: nbaWnbaError } = useBasketballMatches();
  const { matches: euroMatches, isLoading: euroLoading, apiError: euroError } = useEuroLeagueMatches("euroleague");
  const { matches: cupMatches, isLoading: cupLoading, apiError: cupError } = useEuroLeagueMatches("eurocup");

  const isLoading = nbaWnbaLoading || euroLoading || cupLoading;
  const errors = [nbaWnbaError, euroError, cupError].filter(Boolean);

  // Fusionner et filtrer par ligue sélectionnée
  const allMatches = useMemo(() => {
    const matches: UnifiedMatch[] = [];
    if (selectedLeagues.includes("nba") || selectedLeagues.includes("wnba")) {
      matches.push(...nbaWnbaMatches.map((m) => ({
        id: m.id,
        league: m.league,
        scheduledAt: m.scheduledAt,
        status: m.status,
        home: m.home,
        away: m.away,
        pHome: m.pHome,
        pAway: m.pAway,
        edgeElo: m.edgeElo,
      })));
    }
    if (selectedLeagues.includes("euroleague")) {
      matches.push(...euroMatches.map((m) => ({
        id: String(m.id),
        league: "EuroLeague",
        scheduledAt: m.startTime,
        status: m.status === "live" ? "in-progress" : m.status === "finished" ? "post" : "pre",
        home: { abbr: m.home.code, name: m.home.name, score: m.homeScore, record: null },
        away: { abbr: m.away.code, name: m.away.name, score: m.awayScore, record: null },
        pHome: null,
        pAway: null,
        edgeElo: null,
      })));
    }
    if (selectedLeagues.includes("eurocup")) {
      matches.push(...cupMatches.map((m) => ({
        id: String(m.id),
        league: "EuroCup",
        scheduledAt: m.startTime,
        status: m.status === "live" ? "in-progress" : m.status === "finished" ? "post" : "pre",
        home: { abbr: m.home.code, name: m.home.name, score: m.homeScore, record: null },
        away: { abbr: m.away.code, name: m.away.name, score: m.awayScore, record: null },
        pHome: null,
        pAway: null,
        edgeElo: null,
      })));
    }
    return matches;
  }, [selectedLeagues, nbaWnbaMatches, euroMatches, cupMatches]);

  // Compteurs live/prematch
  const liveCount = useMemo(() => allMatches.filter((m) => m.status === "in-progress").length, [allMatches]);
  const prematchCount = useMemo(() => allMatches.filter((m) => m.status !== "in-progress").length, [allMatches]);

  // Filtrer par view mode
  const filteredMatches = useMemo(() => {
    let base = allMatches;
    if (viewMode === "live") base = base.filter((m) => m.status === "in-progress");
    else if (viewMode === "prematch") base = base.filter((m) => m.status !== "in-progress");
    return filterByStartWindow(base, 48, (m) => m.scheduledAt);
  }, [viewMode, allMatches]);

  // Sidebar selection
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  // Ouvrir le dialog de détail quand un match basketball est sélectionné
  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ sport?: string; matchId?: string }>;
      const { sport, matchId } = evt.detail ?? {};
      if (sport !== "basketball" || !matchId) return;
      const match = nbaWnbaMatches.find((m) => m.id === matchId);
      if (match) setDetailMatch(match);
    };
    window.addEventListener("open-match-detail", handler);
    return () => window.removeEventListener("open-match-detail", handler);
  }, [nbaWnbaMatches]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Basket</h2>
        <div className="flex items-center gap-2">
          {/* Toggle Matchs / H2H */}
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => setPageView("matchs")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                pageView === "matchs"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Matchs
            </button>
            <button
              onClick={() => setPageView("h2h")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                pageView === "h2h"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              H2H
            </button>
          </div>
          {pageView === "matchs" && (
            <MatchViewTabs
              active={viewMode}
              onChange={setViewMode}
              liveCount={liveCount}
              prematchCount={prematchCount}
            />
          )}
        </div>
      </div>

      {/* League selector — visible en mode matchs */}
      {pageView === "matchs" && (
        <LeagueSelector
          selected={selectedLeagues}
          onChange={setSelectedLeagues}
        />
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e, i) => (
            <div key={i}>{String(e)}</div>
          ))}
        </div>
      )}

      {/* Vue H2H */}
      {pageView === "h2h" && (
        <BasketballH2H defaultLeague="nba" />
      )}

      {/* Vue Matchs */}
      {pageView === "matchs" && (
        <>
          {/* Loading */}
          {isLoading && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <BasketballMatchCardSkeleton key={`sk-${i}`} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && filteredMatches.length === 0 && (
            <MatchEmptyState mode={viewMode} />
          )}

          {/* Match cards */}
          {!isLoading && filteredMatches.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMatches.map((match) => (
                <BasketballMatchCard
                  key={match.id}
                  match={match}
                  onClick={(m) => setExpandedMatch(m.id)}
                  onDetailRequest={(matchId) => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "basketball", matchId },
                      }),
                    );
                  }}
                  className={cn(
                    expandedMatch === match.id && "border-primary/50 ring-1 ring-primary/20",
                    selectedMatchIds.includes(match.id) && "border-primary",
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialog de détail basketball */}
      {detailMatch && (
        <Suspense fallback={null}>
          <BasketballMatchDetailDialog
            match={detailMatch}
            open
            onOpenChange={(open) => {
              if (!open) setDetailMatch(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
