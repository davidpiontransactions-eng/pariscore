"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  getSportAthleteInfo,
  getSportAthletes,
  getSportAccent,
  SportId,
} from "@/lib/sport-images";
import { TennisPicto } from "@/components/ui/sport-pictograms";

type AthleteGalleryProps = {
  /** Sport actif */
  sport: SportId;
  /** Nombre d'athlètes à afficher */
  maxAthletes?: number;
  /** Taille d'image */
  imageSize?: number;
  /** Mode d'affichage */
  mode?: "grid" | "list";
  /** Callback sur sélection */
  onAthleteSelect?: (info: {
    name: string;
    team?: string;
    nationality?: string;
    rating?: number;
  }) => void;
};

/**
 * AthleteGallery — Galerie d'athlètes stars par sport.
 *
 * Affiche une grille responsive d'athlètes stars par sport avec:
 * - Photos Unsplash libres de droit
 * - Nom, équipe, note (sur 10)
 * - Mode grid (grille) ou list (liste)
 */
export function AthleteGallery({
  sport,
  maxAthletes = 3,
  imageSize = 200,
  mode = "grid",
  onAthleteSelect,
}: AthleteGalleryProps) {
  // Récupérer les athlètes pour le sport
  const athletes = getSportAthletes(sport);
  const displayedAthletes = athletes.slice(0, maxAthletes);

  // Gestion clic athlète
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
    [sport],
  );

  // Couleur accent par sport (calculée directement, pas de useCallback complexe)
  const accentColor = getSportAccent(sport);

  // Mode grid (défaut - grille responsive)
  if (mode === "grid") {
    return (
      <div className="athlete-gallery grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayedAthletes.map((athlete, index) => (
          <div
            key={athlete.name}
            className="athlete-item rounded-xl overflow-hidden border border-border/50 hover:border-primary/20 transition-colors cursor-pointer"
            onClick={() => handleAthleteClick(index)}
            aria-label={`Select ${athlete.name}`}
            style={{ flex: "0 0 auto" }}
          >
            <Image
              src={athlete.imageUrl ?? "/placeholder-athlete.webp"}
              alt={athlete.name}
              className="h-full w-full rounded-t-xl object-cover transition-transform duration-300 group-hover:scale-105"
              width={imageSize}
              height={imageSize}
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
              loading="lazy"
              priority={false}
            />
            <div className="p-2 pt-0">
              <div
                className="text-xs font-medium line-clamp-1"
                style={{ color: accentColor }}
              >
                {athlete.name}
              </div>
              {athlete.team && (
                <div className="text-xxs opacity-70 mt-1">
                  {athlete.team}
                </div>
              )}
              {athlete.nationality && (
                <div className="text-xxs opacity-60">
                  {athlete.nationality}
                </div>
              )}
              <div className="text-xxs mt-1">
                {athlete.rating?.toFixed(1)}/10
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Mode list (liste simple)
  if (mode === "list") {
    return (
      <div className="athlete-list space-y-2">
        {displayedAthletes.map((athlete, index) => (
          <div
            key={athlete.name}
            className="flex items-start gap-2 hover:bg-card/50 transition-colors cursor-pointer"
            onClick={() => handleAthleteClick(index)}
            aria-label={`Select ${athlete.name}`}
          >
            <Image
              src={athlete.imageUrl ?? "/placeholder-athlete.webp"}
              alt={athlete.name}
              className="h-10 w-10 rounded-md object-cover flex-shrink-0 mt-1"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium line-clamp-1">
                {athlete.name}
              </div>
              {athlete.team && (
                <div className="text-xs opacity-70">
                  {athlete.team}
                </div>
              )}
              {athlete.nationality && (
                <div className="text-xs opacity-60">
                  {athlete.nationality}
                </div>
              )}
              <div className="text-xs mt-1">
                {athlete.rating?.toFixed(1)}/10
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}