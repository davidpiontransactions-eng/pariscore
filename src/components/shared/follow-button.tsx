"use client";

import { memo, useCallback, useMemo } from "react";
import { Heart } from "lucide-react";
import { useFollowStore, type FollowCategory } from "@/stores/use-follow-store";
import { cn } from "@/lib/utils";

/**
 * Bouton de suivi (follow) réutilisable.
 *
 * Affiche un coeur qui se remplit quand l'élément est suivi.
 * Utilisable sur :
 * - Cartes de match (follow match)
 * - Profils joueurs (follow player)
 * - Équipes (follow team)
 * - Ligues (follow league)
 *
 * Props :
 * - id: identifiant unique (format: "player:{id}", "team:{sport}:{id}", etc.)
 * - name: nom affiché
 * - category: type d'élément
 * - sport: sport associé (optionnel)
 * - size: taille du bouton (sm, md, lg)
 *
 * Performance: React.memo + useCallback pour éviter les re-renders inutiles
 * quand le composant est utilisé sur plusieurs cartes de match.
 */

type Props = {
  id: string;
  name: string;
  category: FollowCategory;
  sport?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Afficher le nom à côté du coeur */
  showLabel?: boolean;
  /** Callback après toggle */
  onToggle?: (isFollowed: boolean) => void;
};

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

const ICON_SIZES = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

export const FollowButton = memo(function FollowButton({
  id,
  name,
  category,
  sport,
  size = "md",
  className,
  showLabel = false,
  onToggle,
}: Props) {
  const isFollowed = useFollowStore((s) => s.isFollowed(id));
  const toggle = useFollowStore((s) => s.toggle);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle({ id, category, name, sport, notifications: true });
      onToggle?.(!isFollowed);
    },
    [id, category, name, sport, toggle, isFollowed, onToggle],
  );

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all",
        SIZE_CLASSES[size],
        isFollowed
          ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={isFollowed ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      aria-pressed={isFollowed}
    >
      <Heart
        className={cn(ICON_SIZES[size], isFollowed && "fill-current")}
      />
      {showLabel && (
        <span className="ml-1.5 text-xs font-medium">
          {isFollowed ? "Suivi" : "Suivre"}
        </span>
      )}
    </button>
  );
});
