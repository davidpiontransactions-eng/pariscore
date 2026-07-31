"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getSportAccent, type SportId } from "@/lib/sport-images";

// ─── Types ───────────────────────────────────────────────────────────────

type SportImageProps = {
  /** URL source (externe ou locale). */
  src: string | null | undefined;
  /** Texte alternatif obligatoire (a11y). */
  alt: string;
  /** Ratio d'aspect forcé (ex: `16/9`, `1/1`). Défaut: `16/9`. */
  aspectRatio?: string;
  /** Taille width en px pour le calcul `sizes`. */
  intrinsicWidth?: number;
  /** Taille height en px. */
  intrinsicHeight?: number;
  /** Mode fill : occupe tout le conteneur parent (`position: relative` requis). */
  fill?: boolean;
  /** Applique un overlay sombre (gradient + opacité). */
  darkOverlay?: boolean;
  /** Intensité de l'overlay : `light` (30%), `medium` (50%), `heavy` (80%). Défaut : `medium`. */
  overlayIntensity?: "light" | "medium" | "heavy";
  /** Ajoute un flou d'arrière-plan (`backdrop-blur`). */
  blur?: boolean;
  /** Icône sport pour le fallback (ex: `Trophy`, `User`). */
  fallbackIcon?: React.ReactNode;
  /** Texte du fallback (initiales, emoji). */
  fallbackText?: string;
  /** Sport pour la couleur du fallback. */
  sport?: SportId;
  /** Classes CSS additionnelles sur le conteneur. */
  className?: string;
  /** Classes CSS sur le wrapper. */
  wrapperClassName?: string;
  /** Image prioritaire (LCP). */
  priority?: boolean;
};

// ─── Intensités d'overlay ────────────────────────────────────────────────

const OVERLAY_MAP = {
  light: "from-black/30 via-black/15 to-black/30",
  medium: "from-black/50 via-black/30 to-black/60",
  heavy: "from-black/80 via-black/60 to-[#0a0e17]",
} as const;

// ─── Composant ───────────────────────────────────────────────────────────

/**
 * Image sportive réutilisable — wrapper `next/image` avec :
 * - Fallback `onError` → icône + texte sur fond dégradé sport
 * - Overlay sombre paramétrable (light/medium/heavy)
 * - Flou d'arrière-plan (`backdrop-blur`)
 * - Ratio d'aspect fixe ou mode `fill`
 * - Optimisé CLS : `width`/`height` stricts ou `fill` avec conteneur
 */
export function SportImage({
  src,
  alt,
  aspectRatio = "16/9",
  intrinsicWidth = 1200,
  intrinsicHeight = 675,
  fill = false,
  darkOverlay = true,
  overlayIntensity = "medium",
  blur = false,
  fallbackIcon,
  fallbackText,
  sport = "football",
  className,
  wrapperClassName,
  priority = false,
}: SportImageProps) {
  const [hasError, setHasError] = useState(false);
  const accent = getSportAccent(sport);

  // Si pas de source ou erreur → fallback
  if (!src || hasError) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          blur && "backdrop-blur-xl",
          className,
        )}
        style={{
          aspectRatio: fill ? undefined : aspectRatio,
          background: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)`,
        }}
        aria-label={alt}
        role="img"
      >
        <div className="flex flex-col items-center gap-1.5 text-white/50">
          {fallbackIcon ? (
            <span className="opacity-60">{fallbackIcon}</span>
          ) : null}
          {fallbackText ? (
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {fallbackText}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // Image avec overlay
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        fill ? "absolute inset-0" : undefined,
        blur && "backdrop-blur-xl",
        wrapperClassName,
      )}
      style={fill ? undefined : { aspectRatio }}
    >
      <Image
        src={src}
        alt={alt}
        fill={fill ? true : undefined}
        width={fill ? undefined : intrinsicWidth}
        height={fill ? undefined : intrinsicHeight}
        className={cn("object-cover", blur && "scale-105 blur-sm", className)}
        sizes={
          fill
            ? "100vw"
            : `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, ${intrinsicWidth}px`
        }
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setHasError(true)}
        unoptimized={
          // Pour les URLs avec paramètres Unsplash déjà optimisés
          src.includes("images.unsplash.com") ? false : undefined
        }
      />

      {/* Overlay sombre (préserve le contraste du texte superposé) */}
      {darkOverlay && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b",
            OVERLAY_MAP[overlayIntensity],
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
