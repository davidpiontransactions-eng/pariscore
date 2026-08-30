"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTournamentDraw } from "@/hooks/use-tournament-draw";
import { DrawForecastTable } from "./draw-forecast-table";
import { DrawBracket } from "./draw-bracket";
import { SurfaceBadge } from "./surface-badge";
import { RoundBadge } from "./round-badge";
import { Table, BarChart3, Trophy, AlertCircle } from "lucide-react";

type TournamentDrawViewProps = {
  slug: string;
  year?: number;
  className?: string;
};

type ViewMode = "forecast" | "bracket";

function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-3 w-3 animate-pulse rounded bg-muted/40" />
            <div className="h-3 flex-1 animate-pulse rounded bg-muted/40" />
            <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TournamentDrawView({
  slug,
  year,
  className,
}: TournamentDrawViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("forecast");
  const { draw, isLoading, error } = useTournamentDraw(slug, year);

  // État de chargement
  if (isLoading) {
    return (
      <div className={cn("mx-auto max-w-5xl px-4 py-8 sm:px-6", className)}>
        <SkeletonCard />
      </div>
    );
  }

  // Erreur
  if (error) {
    return (
      <div className={cn("mx-auto max-w-5xl px-4 py-8 sm:px-6", className)}>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-sm font-medium">Erreur de chargement</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Impossible de charger le tableau du tournoi.{" "}
            <code className="font-mono text-[10px]">{error.message}</code>
          </p>
        </div>
      </div>
    );
  }

  // Aucune donnée
  if (!draw) {
    return (
      <div className={cn("mx-auto max-w-5xl px-4 py-8 sm:px-6", className)}>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            Aucun tableau disponible pour ce tournoi
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Le tableau sera disponible une fois les données TennisAbstract
            connectées.
          </p>
        </div>
      </div>
    );
  }

  const hasMatches = draw.matches && draw.matches.length > 0;

  return (
    <div className={cn("mx-auto max-w-5xl px-4 py-6 sm:px-6", className)}>
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold tracking-tight">{draw.name}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SurfaceBadge surface={draw.surface} />
          {draw.category && (
            <span className="inline-flex items-center rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none text-muted-foreground">
              {draw.category}
            </span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {draw.year}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {draw.drawSize} joueurs
          </span>
        </div>
      </header>

      {/* Toggle views */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-0.5">
        <button
          type="button"
          onClick={() => setViewMode("forecast")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
            viewMode === "forecast"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Forecast
        </button>
        <button
          type="button"
          onClick={() => setViewMode("bracket")}
          disabled={!hasMatches}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
            viewMode === "bracket"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            !hasMatches && "cursor-not-allowed opacity-40",
          )}
        >
          <Table className="h-3.5 w-3.5" />
          Tableau
        </button>
      </div>

      {/* Contenu */}
      {viewMode === "forecast" ? (
        <DrawForecastTable
          forecast={draw.forecast}
          currentRound={
            draw.forecast.find((f) => f.currentRound)?.currentRound
          }
        />
      ) : hasMatches ? (
        <DrawBracket matches={draw.matches!} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/10 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            Bracket non disponible pour ce tournoi
          </p>
        </div>
      )}

      {/* Footer source */}
      <footer className="mt-4 border-t border-border/40 pt-3 text-[10px] text-muted-foreground/50">
        Source: TennisAbstract · Mis à jour le{" "}
        {new Date(draw.updatedAt).toLocaleDateString("fr-FR")}
      </footer>
    </div>
  );
}
