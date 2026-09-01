import { metadata } from "@/app/results/metadata";
import { notFound } from "next/navigation";

export const generateMetadata = metadata;

"use client";

import { useMemo } from "react";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { SportsSidebar } from "@/components/layout/sports-sidebar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ResultsPage() {
  const { data, isLoading } = useFootballMatches();
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);

  const finishedMatches = useMemo(() => {
    if (!data?.matches) return [];
    return data.matches.filter(m => {
      const leagueIdMatch = !selectedLeagueId || m.league.id === selectedLeagueId;
      const sportIdMatch = !selectedSportId || m.league.countryCode === selectedSportId;
      const finishedMatch = m.live?.status === "FT" || m.live?.status === "PEN";
      return leagueIdMatch && sportIdMatch && finishedMatch;
    });
  }, [data, selectedSportId, selectedLeagueId]);

  if (isLoading) return <Skeleton />;

  return (
    <div className="p-4">
      <SportsSidebar />
      <h1 className="mt-6 text-2xl font-bold">Résultats</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {finishedMatches.map((m) => (
          <Card key={m.id} className="p-4">
            <CardHeader>
              <span className="text-sm">{m.league.name}</span>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span>{m.home.name}</span>
                <span className="text-3xl font-bold">{m.live?.homeScore ?? 0}-{m.live?.awayScore ?? 0}</span>
                <span>{m.away.name}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {m.round} • {new Date(m.scheduledAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}