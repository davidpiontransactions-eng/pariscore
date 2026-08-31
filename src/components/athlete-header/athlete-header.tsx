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

// AthleteHeader — Entête d'athlètes stars par sport.
// Reçoit le sport en prop (pas de context complexe).
type AthleteHeaderProps = {
  /** Sport actif */
  sport: SportId;
  /** Nombre d'athlètes à afficher */
  maxAthletes?: number;
  /** Mode: 'header' (entête) | 'gallery' (galerie latérale) */
  mode?: "header" | "gallery";
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
  onAthleteSelect,
}: AthleteHeaderProps) {
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

  // Couleur accent par sport (calculée directement)
  const accentColor = getSportAccent(sport);

  // Galerie en entête
  const headerGallery = (
    <div className="athlete-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {displayedAthletes.map((athlete, index) => (
        <div
          key={athlete.name}
          className="athlete-card rounded-xl border border-border/50 p-3 hover:border-primary/20 transition-colors cursor-pointer"
          onClick={() => handleAthleteClick(index)}
          aria-label={`Select ${athlete.name}`}
        >
          {/* Image athlète */}
          <div className="relative h-20 w-20 rounded-2xl overflow-hidden mb-2">
            <Image
              src={athlete.imageUrl ?? "/placeholder-athlete.webp"}
              alt={athlete.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              width={80}
              height={80}
              sizes="80px"
              loading="lazy"
              priority={false}
            />
          </div>

          {/* Informations */}
          <div className="text-xs font-medium line-clamp-1" style={{ color: accentColor }}>
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
      ))}
    </div>
  );

  // Galerie latérale simplifiée — seulement 3 athlètes par sport
  const gallerySide = (
    <div
      className="athlete-gallery-side flex-shrink-0 w-64 bg-card/90 p-4"
    >
      <span className="font-medium text-sm mb-2">Sports disponibles</span>
      <div className="space-y-3">
        <div>
          <TennisPicto className="h-4 w-4 mr-1" /> Tennis
          <span className="text-xs">3 athlètes</span>
        </div>
        <div>
          <TennisPicto className="h-4 w-4 mr-1" /> Football
          <span className="text-xs">3 athlètes</span>
        </div>
        <div>
          <TennisPicto className="h-4 w-4 mr-1" /> Basketball
          <span className="text-xs">3 athlètes</span>
        </div>
      </div>
    </div>
  );

  // Déterminer quel renderer utiliser
  let renderer;
  if (mode === "header") {
    renderer = headerGallery;
  } else {
    renderer = gallerySide;
  }

  return (
    <div
      className="athlete-header border-b border-border/70 bg-card/90 backdrop-blur"
    >
      {renderer}
    </div>
  );
}