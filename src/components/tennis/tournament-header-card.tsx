"use client";

import { Trophy, X, MapPin, CalendarDays } from "lucide-react";
import type { TournamentResult } from "@/lib/tennis-search-types";
import { cn } from "@/lib/utils";

type Props = {
  tournament: TournamentResult;
  matchCount: number;
  onClear: () => void;
  className?: string;
};

// Chemins de couleur par surface (code couleur canonique de l'app).
const surfaceColors: Record<string, string> = {
  Terre: "bg-amber-600",
  Dur: "bg-sky-500",
  Gazon: "bg-emerald-500",
  Moquette: "bg-purple-500",
};

/**
 * TournamentHeaderCard — carte affichée en tête de liste des matchs quand un
 * tournoi est sélectionné via la barre de recherche. Filtre la liste des
 * matchs courants sur ce tournoi et permet d'annuler le filtre.
 */
export function TournamentHeaderCard({ tournament, matchCount, onClear, className }: Props) {
  const dotColor = surfaceColors[tournament.surface ?? ""] ?? "bg-slate-500";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
            <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight">
              {tournament.name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {tournament.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {tournament.city}
                </span>
              )}
              {tournament.category && <span>{tournament.category}</span>}
              {tournament.surface && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
                  {tournament.surface}
                </span>
              )}
              {tournament.startDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" aria-hidden />
                  {tournament.startDate}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer le filtre tournoi"
          title="Effacer le filtre tournoi"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" aria-hidden />
          Effacer
        </button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {matchCount > 0 ? `${matchCount} match${matchCount > 1 ? "s" : ""} affiché${matchCount > 1 ? "s" : ""}` : "Aucun match pour ce tournoi."}
      </p>
    </section>
  );
}