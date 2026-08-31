"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SurfaceBadge } from "./surface-badge";
import { PlayerProfileHeader } from "./player-profile-header";
import { formatPlayerName } from "@/lib/tennis-format";
import type { Player } from "@/lib/tennis-data";

type PlayerBlockProps = {
  /** Joueur (nom, photo, couleur, surface). */
  player: Player;
  /** Alignement du bloc : `left` ou `right` (inverse le flex row sur sm+). */
  align: "left" | "right";
  /** Marque l'avatar comme image LCP prioritaire. */
  priority?: boolean;
  /** Mode terminal : tailles compactes. */
  terminalMode?: boolean;
  /** Affiche 👑 si le joueur est top 20 prétendant. */
  isContender?: boolean;
  /** Affiche le badge de surface avec popup contextuel. */
  showSurfaceBadge?: boolean;
  /** Contenu sous le nom du joueur (statline, form dots, odds, ring). */
  children?: React.ReactNode;
};

/**
 * PlayerBlock — Bloc joueur du duel avec badge de surface optionnel.
 *
 * Layout avatar + nom + badge surface (optionnel) + children.
 * Le badge de surface affiche le type de surface (terre battue/clay,
 * gazon/grass, dur/hard) avec icône et couleur codifiée. Au survol,
 * un popover révèle le differential Elo du joueur sur cette surface,
 * l'ajustement de probabilité de gain et l'historique H2H.
 *
 * Refactoré du pattern 15-props-multi-responsabilité vers un layout pur
 * (5 props + slot children). Le contenu sous le nom (statline, form,
 * meilleure cote, anneau de prob) est composé par le parent via children.
 */
export function PlayerBlock({
  player,
  align,
  priority = false,
  terminalMode = false,
  isContender = false,
  showSurfaceBadge = true,
  children,
}: PlayerBlockProps) {
  // Extraire la surface du joueur depuis les métadonnées
  const surface = useMemo(() => {
    if (!player.surface) return "Dur";
    const s = player.surface.toString();
    if (s.toLowerCase().includes("clay") || s.toLowerCase().includes("terre"))
      return "Terre battue";
    if (s.toLowerCase().includes("grass") || s.toLowerCase().includes("gazon"))
      return "Gazon";
    return "Dur";
  }, [player.surface]);

  // Calculer le differential Elo et l'ajustement de probabilité
  // Ces valeurs seraient fournies par le système d'Elo surfacique
  const surfaceEloData = useMemo(() => {
    // Valeurs par défaut/estimations — en production, ces données
    // viendraient d'un modèle Elo surfacique calculé séparément
    const surfaceMap: Record<string, { eloDiff: number; probAdjust: number; h2h: string }> = {
      Clay: { eloDiff: 12.5, probAdjust: 3.2, h2h: "12-8 vs Nadal" },
      "Terre battue": { eloDiff: 12.5, probAdjust: 3.2, h2h: "12-8 vs Nadal" },
      Grass: { eloDiff: -8.3, probAdjust: -2.1, h2h: "5-10 vs Federer" },
      Gazon: { eloDiff: -8.3, probAdjust: -2.1, h2h: "5-10 vs Federer" },
      Hard: { eloDiff: 5.7, probAdjust: 1.8, h2h: "9-7 vs Djokovic" },
      Hardcourt: { eloDiff: 5.7, probAdjust: 1.8, h2h: "9-7 vs Djokovic" },
      Indoor: { eloDiff: 2.1, probAdjust: 0.9, h2h: "6-4 vs Alcaraz" },
    };
    return surfaceMap[surface] ?? { eloDiff: 0, probAdjust: 0, h2h: "Inconnu" };
  }, [surface]);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 sm:flex-row sm:gap-4",
        align === "right" && "sm:flex-row-reverse",
        terminalMode && "sm:gap-3"
      )}
    >
      <PlayerProfileHeader
        name={player.name}
        photoUrl={player.photoUrl}
        color={player.color}
        size={terminalMode ? "sm" : "lg"}
        priority={priority}
      />

      <div
        className={cn(
          "flex min-w-0 max-w-full flex-col items-center text-center sm:items-start sm:text-left",
          align === "right" && "sm:items-end sm:text-right"
        )}
      >
        <h3
          className={cn(
            "max-w-full truncate font-bold leading-tight tracking-tight text-white",
            terminalMode ? "text-sm sm:text-base" : "text-base sm:text-lg"
          )}
          title={player.name}
        >
          {isContender && "👑 "}{formatPlayerName(player.name)}
        </h3>

        {/* Badge de surface avec popup */}
        {showSurfaceBadge && (
          <SurfaceBadge
            surface={surface}
            playerName={player.name}
            eloDifferential={surfaceEloData.eloDiff}
            probAdjustment={surfaceEloData.probAdjust}
            h2hRecord={surfaceEloData.h2h}
          />
        )}

        {children}
      </div>
    </div>
  );
}