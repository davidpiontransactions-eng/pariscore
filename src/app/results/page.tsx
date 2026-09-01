"use client";

import { useMemo, useState } from "react";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { SportsSidebar } from "@/components/layout/sports-sidebar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function generateMetadata() {
  return {
    title: "Résultats de matchs — PariScore",
    description:
      "Résultats des matchs terminés avec scores finaux, ligues et dates – tous sports",
    keywords: ["résultats", "matchs", "scores", "ligues", "football", "tennis", "basketball"],
  };
}

export default function ResultsPage() {
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const activeSport = selectedSportId ?? "football";
  const onSportChange = useSportsSidebarStore((s) => s.selectSport) ?? (() => {});

  const [sport, setSport] = useState(activeSport);

  const fetchMatches = async () => {
    try {
      const res = await fetch(
        `/api/v1/multi-matches?sport=${sport}${
          selectedLeagueId ? `&league=${selectedLeagueId}` : ""
        }&status=FT`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("API multi-matches échouée");
      const data = await res.json();
      return data.matches ?? [];
    } catch (err) {
      console.error("[Results] fetch multi-matches error:", err);
      return [];
    }
  };

  const finishedMatches = useMemo(() => fetchMatches(), [sport, selectedLeagueId]);

  if (finishedMatches.length === 0 && sport !== "football") {
    // Fallback : essayer football si pas de matches pour le sport choisi
    // (l'API retry est gérée côté client via le bouton sport change)
  }

  return (
    <div className="p-4">
      <SportsSidebar
        activeSport={activeSport}
        onSportChange={(sportId: string) => {
          setSport(sportId);
          useSportsSidebarStore.getState().selectSport(sportId);
        }}
      />
      <h1 className="mt-6 text-2xl font-bold">Résultats</h1>

      {finishedMatches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {finishedMatches.map((m) => (
            <Card key={m.id} className="p-4">
              <CardHeader>
                <span className="text-sm">{m.league?.name ?? m.sport ?? "Inconnu"}</span>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>{m.home?.name ?? m.home ?? "—"}</span>
                  <span className="text-3xl font-bold">
                    {m.homeScore ?? m.score?.home ?? 0}-{m.awayScore ?? m.score?.away ?? 0}
                  </span>
                  <span>{m.away?.name ?? m.away ?? "—"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {m.round ?? ""} • {new Date(m.scheduledAt ?? Date.now()).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="alert alert-info mt-4">
          Aucun match terminé trouvé pour {sport}. Essaye de changer de sport via la sidebar.
        </div>
      )}
    </div>
  );
}