"use client";

import { useCallback } from "react";
import {
  getSportAthleteInfo,
  getSportAthletes,
  getSportAccent,
  SportId,
} from "@/lib/sport-images";
import { TennisPicto, FootballPicto, BasketballPicto } from "@/components/ui/sport-pictograms";
import { AthleteCard, AthleteCardSkeleton } from "./athlete-card";

type AthleteHeaderProps = {
  /** Sport actif */
  sport: SportId;
  /** Nombre d'athlètes à afficher */
  maxAthletes?: number;
  /** Mode: 'header' (entête) | 'gallery' (galerie latérale) */
  mode?: "header" | "gallery";
  /** État de chargement */
  isLoading?: boolean;
  /** Callback sur sélection d'un athlète */
  onAthleteSelect?: (info: {
    name: string;
    team?: string;
    nationality?: string;
    rating?: number;
  }) => void;
};

/**
 * AthleteHeader — Entête ou galerie d'athlètes stars par sport.
 *
 * Affiche:
 * - Image(s) d'athlètes stars du sport actif
 * - Nom, équipe, note (sur 10)
 * - Mode header (en entête de page) ou gallery (latéral)
 */
export function AthleteHeader({
  sport,
  maxAthletes = 3,
  mode = "header",
  isLoading = false,
  onAthleteSelect,
}: AthleteHeaderProps) {
  const athletes = getSportAthletes(sport);
  const displayedAthletes = athletes.slice(0, maxAthletes);
  const accentColor = getSportAccent(sport);

  const handleAthleteClick = useCallback(
    (index: number) => {
      const info = getSportAthleteInfo(sport, index);
      onAthleteSelect?.({
        name: info.name,
        team: info.team,
        nationality: info.nationality,
        rating: info.rating,
      });
    },
    [sport, onAthleteSelect],
  );

  // Galerie en entête
  const headerGallery = (
    <div className="athlete-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {isLoading
        ? Array.from({ length: maxAthletes }).map((_, i) => (
            <AthleteCardSkeleton key={`skeleton-${i}`} />
          ))
        : displayedAthletes.map((athlete, index) => (
            <AthleteCard
              key={athlete.name}
              athlete={athlete}
              accentColor={accentColor}
              onClick={() => handleAthleteClick(index)}
            />
          ))
      }
    </div>
  );

  // Galerie latérale — sports disponibles avec icônes correctes
  const gallerySide = (
    <div className="athlete-gallery-side flex-shrink-0 w-64 bg-card/90 p-4">
      <span className="font-medium text-sm mb-2">Sports disponibles</span>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TennisPicto className="h-4 w-4" />
          <span className="text-xs">Tennis</span>
          <span className="text-xxs opacity-60 ml-auto">3 athlètes</span>
        </div>
        <div className="flex items-center gap-2">
          <FootballPicto className="h-4 w-4" />
          <span className="text-xs">Football</span>
          <span className="text-xxs opacity-60 ml-auto">3 athlètes</span>
        </div>
        <div className="flex items-center gap-2">
          <BasketballPicto className="h-4 w-4" />
          <span className="text-xs">Basketball</span>
          <span className="text-xxs opacity-60 ml-auto">3 athlètes</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="athlete-header border-b border-border/70 bg-card/90 backdrop-blur">
      {mode === "header" ? headerGallery : gallerySide}
    </div>
  );
}
