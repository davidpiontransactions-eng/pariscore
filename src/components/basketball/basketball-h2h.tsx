"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { H2HTeamSelector } from "./h2h-team-selector";
import { H2HHeader } from "./h2h-header";
import { H2HStatsTab } from "./h2h-stats-tab";
import { H2HMatchesTab } from "./h2h-matches-tab";
import { H2HPlayersTab } from "./h2h-players-tab";
import { H2HStandingsPanel } from "./h2h-standings-panel";
import { useBasketballH2H } from "@/hooks/use-basketball-h2h";
import { useH2HPlayers } from "@/hooks/use-h2h-players";

type BasketballH2HProps = {
  className?: string;
  /** Ligue par défaut (NBA ou WNBA). */
  defaultLeague?: "nba" | "wnba";
};

export function BasketballH2H({ className, defaultLeague = "nba" }: BasketballH2HProps) {
  const [league, setLeague] = useState<"nba" | "wnba">(defaultLeague);
  const [teamAId, setTeamAId] = useState<string | null>(null);
  const [teamBId, setTeamBId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("stats");

  const { h2h, isLoading, error } = useBasketballH2H(league, teamAId, teamBId);

  // Joueurs pour les 2 équipes + standings via équipe A
  const { players: playersA, standings } = useH2HPlayers(league, teamAId);
  const { players: playersB } = useH2HPlayers(league, teamBId);

  const handleSwap = useCallback(() => {
    setTeamAId(teamBId);
    setTeamBId(teamAId);
  }, [teamAId, teamBId]);

  // League toggle
  const toggleLeague = () => {
    setLeague((l) => (l === "nba" ? "wnba" : "nba"));
    setTeamAId(null);
    setTeamBId(null);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* League toggle + selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={toggleLeague}
          className="rounded-md bg-muted px-3 py-1.5 text-xs font-bold hover:bg-muted/80 transition-colors"
        >
          {league === "nba" ? "NBA" : "WNBA"}
        </button>
        <H2HTeamSelector
          league={league}
          teamAId={teamAId}
          teamBId={teamBId}
          onTeamAChange={setTeamAId}
          onTeamBChange={setTeamBId}
          onSwap={handleSwap}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && teamAId && teamBId && (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Chargement des données H2H...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !h2h && (
        <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          Sélectionnez deux équipes pour afficher les statistiques H2H.
        </div>
      )}

      {/* Résultats */}
      {h2h && (
        <>
          <H2HHeader
            teamAName={h2h.teamA.info.name}
            teamAAbr={h2h.teamA.info.abbr}
            teamALogo={h2h.teamA.info.logo}
            teamBName={h2h.teamB.info.name}
            teamBAbr={h2h.teamB.info.abbr}
            teamBLogo={h2h.teamB.info.logo}
            split={h2h.split}
            formA={h2h.teamA.seasonStats.form6}
            formB={h2h.teamB.seasonStats.form6}
            netRatingA={h2h.teamA.seasonStats.overall?.avgMargin ?? null}
            netRatingB={h2h.teamB.seasonStats.overall?.avgMargin ?? null}
          />

          <div className="flex gap-3 lg:flex-row flex-col">
            {/* Contenu principal */}
            <div className="flex-1 min-w-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="stats" className="text-[11px] px-3 h-7">
                    Stats
                  </TabsTrigger>
                  <TabsTrigger value="confrontations" className="text-[11px] px-3 h-7">
                    Confrontations ({h2h.matches.length})
                  </TabsTrigger>
                  <TabsTrigger value="joueurs" className="text-[11px] px-3 h-7">
                    Joueurs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="mt-2 tab-content-animate">
                  <H2HStatsTab
                    dataPoints={h2h.dataPoints}
                    teamAAbr={h2h.teamA.info.abbr}
                    teamBAbr={h2h.teamB.info.abbr}
                    seasonStatsA={h2h.teamA.seasonStats}
                    seasonStatsB={h2h.teamB.seasonStats}
                    overStatsA={h2h.teamA.overStats}
                    overStatsB={h2h.teamB.overStats}
                    spreadStatsA={h2h.teamA.spreadStats}
                    spreadStatsB={h2h.teamB.spreadStats}
                    matchOver={h2h.matchOver}
                    btts={h2h.btts}
                  />
                </TabsContent>

                <TabsContent value="confrontations" className="mt-2 tab-content-animate">
                  <H2HMatchesTab
                    matches={h2h.matches}
                    teamAId={teamAId}
                    teamBId={teamBId}
                  />
                </TabsContent>

                <TabsContent value="joueurs" className="mt-2 tab-content-animate">
                  <H2HPlayersTab
                    playersA={playersA}
                    playersB={playersB}
                    teamAAbr={h2h.teamA.info.abbr}
                    teamBAbr={h2h.teamB.info.abbr}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Side panel — standings (desktop lg:+) */}
            <div className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-4">
                <H2HStandingsPanel
                  standings={standings}
                  teamAId={teamAId}
                  teamBId={teamBId}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
