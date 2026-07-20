"use client";

import type { Player } from "@/lib/tennis-data";
import { PlayerProfileHeader } from "./player-profile-header";
import { cn } from "@/lib/utils";

type Props = {
  /** Joueur (nom, photo, couleur). */
  player: Player;
  /** Alignement du bloc : `left` ou `right` (inverse le flex row sur sm+). */
  align: "left" | "right";
  /** Marque l'avatar comme image LCP prioritaire. */
  priority?: boolean;
  /** Mode terminal : tailles compactes. */
  terminalMode?: boolean;
  /** Contenu sous le nom du joueur (statline, form dots, odds, ring). */
  children?: React.ReactNode;
};

/**
 * Bloc joueur du duel — layout avatar + nom + children.
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
  children,
}: Props) {
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
            "max-w-full truncate font-bold leading-tight tracking-tight",
            terminalMode ? "text-sm sm:text-base" : "text-base sm:text-lg"
          )}
          title={player.name}
        >
          {player.name}
        </h3>
        {children}
      </div>
    </div>
  );
}
