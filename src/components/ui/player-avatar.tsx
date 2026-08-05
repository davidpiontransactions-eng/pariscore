"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getSportAccent, type SportId } from "@/lib/sport-images";
import { CountryFlag } from "@/components/tennis/country-flag";

// ─── Types ───────────────────────────────────────────────────────────────

type PlayerAvatarProps = {
  /** Nom du joueur/équipe (pour alt et initiales fallback). */
  name: string;
  /** URL de la photo/logo (peut être null → fallback). */
  photoUrl?: string | null;
  /** Couleur principale (anneau lumineux, fond fallback). */
  color?: string;
  /** Taille : sm=40px, md=56px, lg=72px, xl=96px. Défaut : `md`. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Code pays ISO pour badge drapeau (optionnel). */
  countryCode?: string | null;
  /** Sport pour la couleur de fallback. Défaut : `tennis`. */
  sport?: SportId;
  /** Image prioritaire (LCP). */
  priority?: boolean;
  /** Classes additionnelles. */
  className?: string;
};

// ─── Taille map ──────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { avatar: 40, ring: 44, flag: "sm" as const },
  md: { avatar: 56, ring: 62, flag: "sm" as const },
  lg: { avatar: 72, ring: 80, flag: "md" as const },
  xl: { avatar: 96, ring: 106, flag: "lg" as const },
};

// ─── Initiales (extraction 2 lettres) ────────────────────────────────────

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─── Composant ───────────────────────────────────────────────────────────

/**
 * Avatar joueur/équipe unifié — compatible Tennis, Football, MMA, NBA, etc.
 *
 * - `<Image />` de `next/image` pour optimisation automatique
 * - Fallback `onError` → initiales sur fond dégradé couleur du sport
 * - Anneau lumineux `border-{color}/30`
 * - Badge `CountryFlag` optionnel (superposé en bas à droite)
 * - Tailles standardisées : sm, md, lg, xl
 */
export function PlayerAvatar({
  name,
  photoUrl,
  color,
  size = "md",
  countryCode,
  sport = "tennis",
  priority = false,
  className,
}: PlayerAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const dims = SIZE_MAP[size];
  const accent = color || getSportAccent(sport);

  // Conteneur avec anneau lumineux
  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: dims.ring, height: dims.ring }}
    >
      {/* Anneau lumineux arrière-plan */}
      <div
        className="pointer-events-none absolute -inset-[2px] rounded-full opacity-25"
        style={{ background: accent }}
        aria-hidden
      />

      {/* Avatar avec ring */}
      <div
        className="relative overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-background"
        style={{
          width: dims.avatar,
          height: dims.avatar,
          "--tw-ring-color": accent,
        } as React.CSSProperties}
      >
        {/* Image ou fallback */}
        {photoUrl && !hasError ? (
          <Image
            src={photoUrl}
            alt={name}
            width={dims.avatar}
            height={dims.avatar}
            className="h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            onError={() => setHasError(true)}
            unoptimized={
              // Pour les URLs CDN externes sans params Next
              // (+ dicebear : renvoie du SVG, que l'optimiseur next/image
              // rejette systématiquement sans dangerouslyAllowSVG)
              photoUrl.includes("chatglm.cn") ||
              photoUrl.includes("api-sports.io") ||
              photoUrl.includes("dicebear.com")
            }
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span
              className="select-none text-xs font-bold uppercase tracking-wider"
              style={{ color: accent, opacity: 0.7 }}
            >
              {getInitials(name)}
            </span>
          </div>
        )}
      </div>

      {/* Badge drapeau (bas-droite) */}
      {countryCode && (
        <span className="absolute -bottom-0.5 -right-0.5 z-10 rounded-full border border-background bg-background/90 p-px">
          <CountryFlag countryCode={countryCode} size={dims.flag} />
        </span>
      )}
    </div>
  );
}
