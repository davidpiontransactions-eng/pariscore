"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Tab, X, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type SportChipProps = {
  /** Sport clé actuellement actif */
  activeSport: string;
  /** Callback sur sélection du sport */
  onSportSelect: (sport: string) => void;
  /** Largeur minimale des chips */
  minWidth?: number;
};

/**
 * SportChips — Filtres de sport par chips horizontaux.
 *
 * Remplace la navigation principale par une barre de chips affichant
 * tous les sports ; chip actif a un pulse subtil ; le clic filtre le
 * catalogue instantanément.
 */
export function SportChips({
  activeSport,
  onSportSelect,
  minWidth = 72,
}: SportChipProps) {
  const t = useTranslations("sports");
  const sports = [
    "football",
    "tennis",
    "basketball",
    "mma",
    "cycling",
    "f1",
    "baseball",
    "rugby",
  ];

  const handleSelect = (sport: string) => {
    onSportSelect(sport);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {sports.map((sport) => {
        const isActive = activeSport === sport;
        const chipMinWidth = Math.max(minWidth, 60 + sport.length * 8);

        return (
          <Button
            key={sport}
            variant={isActive ? "default" : "ghost"}
            size="icon"
            onClick={() => handleSelect(sport)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isActive
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
              "min-w-[%" + chipMinWidth + "px]"
            )}
            aria-pressed={isActive}
            aria-label={t(`sport.${sport}`)}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            <span>{t(`sport.${sport}`)}</span>
          </Button>
        );
      })}
    </div>
  );
}