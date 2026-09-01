import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AthleteInfo } from "@/lib/sport-images";

/** Couleur du badge selon la note (inspiré SofaScore) */
function getRatingBadgeColor(rating: number): string {
  if (rating >= 9.0) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (rating >= 8.0) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (rating >= 7.0) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (rating >= 6.0) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

type AthleteCardProps = {
  athlete: AthleteInfo;
  accentColor: string;
  variant?: "grid" | "list";
  onClick?: () => void;
  className?: string;
};

/**
 * AthleteCard — Composant partagé pour l'affichage d'un athlète.
 *
 * Utilisé par AthleteHeader (grid) et potentiellement par d'autres vues.
 * Accessibility: role="button", tabIndex=0, onKeyDown pour Enter/Space.
 */
export function AthleteCard({
  athlete,
  accentColor,
  variant = "grid",
  onClick,
  className,
}: AthleteCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  if (variant === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-start gap-2 hover:bg-card/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          className
        )}
        aria-label={`Select ${athlete.name}${athlete.team ? `, ${athlete.team}` : ""}`}
      >
        <Image
          src={athlete.imageUrl ?? "/placeholder-athlete.webp"}
          alt={athlete.name}
          className="h-10 w-10 rounded-md object-cover flex-shrink-0 mt-1"
          width={40}
          height={40}
          sizes="40px"
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
          {athlete.rating != null && (
            <div className={cn(
              "text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded-full border inline-block",
              getRatingBadgeColor(athlete.rating)
            )}>
              {athlete.rating.toFixed(1)}/10
            </div>
          )}
        </div>
      </div>
    );
  }

  // Variante grid (défaut)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group athlete-card rounded-xl border border-border/50 p-3 hover:border-primary/20 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        className
      )}
      aria-label={`Select ${athlete.name}${athlete.team ? `, ${athlete.team}` : ""}`}
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
      {athlete.rating != null && (
        <div className={cn(
          "text-xxs font-semibold mt-1 px-1.5 py-0.5 rounded-full border inline-block",
          getRatingBadgeColor(athlete.rating)
        )}>
          {athlete.rating.toFixed(1)}/10
        </div>
      )}
    </div>
  );
}
