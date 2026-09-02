"use client";

import { useEffect, useState } from "react";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { SportsSidebar } from "@/components/layout/sports-sidebar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Match = {
  id: string | number;
  home?: { name?: string } | string;
  away?: { name?: string } | string;
  homeScore?: number;
  awayScore?: number;
  score?: { home?: number; away?: number };
  league?: { name?: string };
  sport?: string;
  round?: string;
  scheduledAt?: string | number;
};

const formatDate = (date: string | number | undefined) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

const teamName = (t: Match["home"]) =>
  typeof t === "object" && t !== null ? (t.name ?? "—") : (t ?? "—");

export function ResultsClient() {
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const activeSport = selectedSportId ?? "football";

  const [sport, setSport] = useState(activeSport);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async (sportKey: string, leagueId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = `/api/v1/multi-matches?sport=${sportKey}${leagueId ? `&league=${leagueId}` : ""}&status=FT`;
      const res = await fetch(qs, { cache: "no-store" });
      if (!res.ok) throw new Error("API multi-matches échouée");
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (err) {
      console.error("[Results] fetch multi-matches error:", err);
      setError("Impossible de charger les résultats.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(sport, selectedLeagueId);
  }, [sport, selectedLeagueId]);

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

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchMatches(sport, selectedLeagueId)}
            className="mt-2 underline underline-offset-2 hover:opacity-80"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Aucun match trouvé pour {sport}.
        </div>
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {matches.map((m) => (
            <Card key={m.id} className="p-4">
              <CardHeader>
                <span className="text-sm">
                  {m.league?.name ?? m.sport ?? "Inconnu"}
                </span>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>{teamName(m.home)}</span>
                  <span className="text-3xl font-bold tabular-nums">
                    {m.homeScore ?? m.score?.home ?? 0}–{m.awayScore ?? m.score?.away ?? 0}
                  </span>
                  <span>{teamName(m.away)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {m.round ?? ""} • {formatDate(m.scheduledAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}