"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
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

/** Couleur du badge position */
function getPositionBadgeColor(position: string): string {
  const pos = position.toLowerCase();
  if (pos.includes("goal") || pos.includes("gardien") || pos.includes("gk")) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/25";
  if (pos.includes("def") || pos.includes("défens") || pos.includes("central")) return "bg-blue-500/15 text-blue-400 border-blue-500/25";
  if (pos.includes("milieu") || pos.includes("midfield") || pos.includes("mf")) return "bg-purple-500/15 text-purple-400 border-purple-500/25";
  if (pos.includes("attaq") || pos.includes("forward") || pos.includes("wing") || pos.includes("att")) return "bg-red-500/15 text-red-400 border-red-500/25";
  return "bg-slate-500/15 text-slate-400 border-slate-500/25";
}

/** Abréviation position */
function getPositionAbbrev(position: string): string {
  const pos = position.toLowerCase();
  if (pos.includes("goal") || pos.includes("gardien") || pos.includes("gk")) return "GK";
  if (pos.includes("def") || pos.includes("défens") || pos.includes("central")) return "DEF";
  if (pos.includes("milieu") || pos.includes("midfield") || pos.includes("mf")) return "MIL";
  if (pos.includes("attaq") || pos.includes("forward") || pos.includes("wing") || pos.includes("att")) return "ATT";
  if (pos.includes("ailier")) return "W";
  if (pos.includes("pilote")) return "PIL";
  return position.slice(0, 3).toUpperCase();
}

/** Forme récente — 5 derniers résultats (W=win, D=draw, L=loss) */
type FormResult = "W" | "D" | "L";

function getFormDotColor(result: FormResult): string {
  if (result === "W") return "bg-emerald-500";
  if (result === "D") return "bg-yellow-500";
  return "bg-red-500";
}

function FormDots({ form }: { form: FormResult[] }) {
  const formLabels = form.map((r) => (r === "W" ? "Win" : r === "D" ? "Draw" : "Loss"));
  return (
    <div className="flex items-center gap-0.5" aria-label={`Recent form: ${formLabels.join(", ")}`}>
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-full", getFormDotColor(result))}
          title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
        />
      ))}
    </div>
  );
}

const FAVORITES_KEY = "ps-athlete-favorites";

function getFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function toggleFavorite(name: string): Set<string> {
  const favs = getFavorites();
  if (favs.has(name)) {
    favs.delete(name);
  } else {
    favs.add(name);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  return favs;
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
 * Accessibility: role="button", tabIndex=0, onKeyDown quand onClick est fourni.
 */
export function AthleteCard({
  athlete,
  accentColor,
  variant = "grid",
  onClick,
  className,
}: AthleteCardProps) {
  const [isFavorite, setIsFavorite] = useState(() => getFavorites().has(athlete.name));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = toggleFavorite(athlete.name);
    setIsFavorite(newFavs.has(athlete.name));
  }, [athlete.name]);

  if (variant === "list") {
    return (
      <div
        {...(onClick
          ? {
              role: "button" as const,
              tabIndex: 0,
              onClick,
              onKeyDown: handleKeyDown,
            }
          : {})}
        className={cn(
          "flex items-start gap-2 hover:bg-card/50 transition-colors",
          onClick && "cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          className
        )}
        aria-label={`Select ${athlete.name}${athlete.team ? `, ${athlete.team}` : ""}`}
      >
        <div className="relative flex-shrink-0 mt-1">
          <Image
            src={athlete.imageUrl ?? "/placeholder-athlete.webp"}
            alt={athlete.name}
            className="h-10 w-10 rounded-md object-cover"
            width={40}
            height={40}
            sizes="40px"
            loading="lazy"
          />
          {athlete.position && (
            <span
              aria-label={athlete.position}
              className={cn(
                "absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.5 rounded border leading-none",
                getPositionBadgeColor(athlete.position)
              )}
            >
              {getPositionAbbrev(athlete.position)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium line-clamp-1">{athlete.name}</span>
            <button
              type="button"
              onClick={handleFavoriteClick}
              className={cn(
                "flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded transition-all duration-200",
                "hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                isFavorite ? "text-red-400" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={isFavorite ? `Remove ${athlete.name} from favorites` : `Add ${athlete.name} to favorites`}
            >
              <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {athlete.team && (
              <span className="text-xs opacity-75">{athlete.team}</span>
            )}
            {athlete.nationality && (
              <span className="text-xs opacity-60">· {athlete.nationality}</span>
            )}
          </div>
          {athlete.rating != null && (
            <div className={cn(
              "text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded-full border inline-block",
              getRatingBadgeColor(athlete.rating)
            )}>
              {athlete.rating.toFixed(1)}/10
            </div>
          )}
          {athlete.form && athlete.form.length > 0 && (
            <div className="mt-1">
              <FormDots form={athlete.form} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Variante grid (défaut)
  return (
    <div
      {...(onClick
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      className={cn(
        "group athlete-card rounded-xl border border-border/50 p-3 hover:border-primary/20 transition-colors",
        onClick && "cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        className
      )}
      aria-label={`Select ${athlete.name}${athlete.team ? `, ${athlete.team}` : ""}`}
    >
      {/* Image athlète + badge position + favori */}
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
        {athlete.position && (
          <span
            aria-label={athlete.position}
            className={cn(
              "absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 py-0.5 rounded border leading-none backdrop-blur-sm",
              getPositionBadgeColor(athlete.position)
            )}
          >
            {getPositionAbbrev(athlete.position)}
          </span>
        )}
        <button
          type="button"
          onClick={handleFavoriteClick}
          className={cn(
            "absolute top-0.5 right-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full transition-all duration-200",
            "hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-emerald-500/50",
            isFavorite ? "text-red-400" : "text-white/60 hover:text-white"
          )}
          aria-label={isFavorite ? `Remove ${athlete.name} from favorites` : `Add ${athlete.name} to favorites`}
        >
          <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Informations */}
      <div className="text-xs font-medium line-clamp-1" style={{ color: accentColor }}>
        {athlete.name}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        {athlete.team && (
          <span className="text-xxs opacity-75">{athlete.team}</span>
        )}
        {athlete.nationality && (
          <span className="text-xxs opacity-60">· {athlete.nationality}</span>
        )}
      </div>
      {athlete.rating != null && (
        <div className={cn(
          "text-xxs font-semibold mt-1 px-1.5 py-0.5 rounded-full border inline-block",
          getRatingBadgeColor(athlete.rating)
        )}>
          {athlete.rating.toFixed(1)}/10
        </div>
      )}
      {athlete.form && athlete.form.length > 0 && (
        <div className="mt-1.5">
          <FormDots form={athlete.form} />
        </div>
      )}
    </div>
  );
}

/**
 * AthleteCardSkeleton — Placeholder de chargement pour AthleteCard.
 * Utilise des animations pulse pour indiquer le chargement.
 */
export function AthleteCardSkeleton({ variant = "grid" }: { variant?: "grid" | "list" }) {
  if (variant === "list") {
    return (
      <div className="flex items-start gap-2 animate-pulse" aria-busy="true" role="status">
        <span className="sr-only">Loading...</span>
        <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0 mt-1" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2.5 w-16 rounded bg-muted" />
          <div className="h-4 w-10 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse rounded-xl border border-border/50 p-3" aria-busy="true" role="status">
      <span className="sr-only">Loading...</span>
      <div className="h-20 w-20 rounded-2xl bg-muted mb-2" />
      <div className="h-3 w-20 rounded bg-muted mb-1" />
      <div className="h-2.5 w-16 rounded bg-muted mb-0.5" />
      <div className="h-2.5 w-12 rounded bg-muted mb-1" />
      <div className="h-4 w-10 rounded-full bg-muted" />
    </div>
  );
}
