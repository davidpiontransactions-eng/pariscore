"use client";

import type { BaseballMatch } from "@/lib/baseball/types";
import { BaseballMatchCard } from "./BaseballMatchCard";

interface BaseballMatchScheduleProps {
  date: string;
  matches: BaseballMatch[];
  isLoading: boolean;
  degraded: boolean;
  onOpenMatch: (matchId: string) => void;
}

/**
 * Calendrier HLTV-style : grille dense de cartes de match, tri par heure
 * locale Paris, états vides explicites (hors saison / ligue sans match).
 */
export function BaseballMatchSchedule({
  date,
  matches,
  isLoading,
  degraded,
  onOpenMatch,
}: BaseballMatchScheduleProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl border border-slate-800 bg-[#11161f]"
          />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#11161f] px-6 py-14 text-center">
        <span className="text-3xl">⚾</span>
        <p className="text-sm font-semibold text-slate-200">
          Aucun match ce jour ({date})
        </p>
        <p className="max-w-md text-xs text-slate-500">
          {degraded
            ? "La MLB StatsAPI est momentanément injoignable — le mode dégradé affiche uniquement la KBO (données curées)."
            : "Journée sans rencontre MLB ni KBO (hors saison ou journée de repos). Naviguez avec les flèches pour explorer la semaine."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <BaseballMatchCard key={match.game.id} match={match} onOpen={onOpenMatch} />
      ))}
    </div>
  );
}
