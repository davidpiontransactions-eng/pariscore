"use client";

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

export function FollowButton({
  id,
  name,
  category,
  sport,
  size = "md",
  className,
  showLabel = false,
  onToggle,
}: Props) {
  const { isFollowed, toggle, setNotifications } = useFollowStore();
  const followed = isFollowed(id);

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // éviter la propagation vers le parent
    toggle({ id, category, name, sport, notifications: true });
    onToggle?.(!followed);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all",
        sizeClasses[size],
        followed
          ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={followed ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      aria-pressed={followed}
    >
      <Heart
        className={cn(iconSizes[size], followed && "fill-current")}
      />
      {showLabel && (
        <span className="ml-1.5 text-xs font-medium">
          {followed ? "Suivi" : "Suivre"}
        </span>
      )}
    </button>
  );
}
