"use client";

/**
 * PlayerProfileHeader — Avatar + nom tronqué "A. Rublev"
 *
 * Composant réutilisable pour le haut de carte PREMATCH et LIVE.
 * Gère automatiquement :
 *   - Troncature du prénom : "Andrey Rublev" → "A. Rublev"
 *   - Photo joueur via Avatar shadcn (Radix)
 *   - Fallback initiales si photo manquante / erreur de chargement
 *   - Anneau coloré autour de l'avatar (couleur du joueur)
 *
 * Utilisation :
 *   <PlayerProfileHeader
 *     name="Andrey Rublev"
 *     photoUrl="https://..."
 *     color="#B91C1C"
 *     size="lg"
 *   />
 */

import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

export type ProfileSize = "sm" | "md" | "lg";

type Props = {
  /** Nom complet du joueur (ex: "Andrey Rublev") */
  name: string;
  /** URL photo (peut être undefined/null → fallback initiales) */
  photoUrl?: string | null;
  /** Couleur du joueur (anneau autour de l'avatar) */
  color?: string;
  /** Taille du profile : sm=40px, md=56px, lg=72px (défaut) */
  size?: ProfileSize;
  /** Image prioritaire (loading eager + fetchPriority high) pour LCP */
  priority?: boolean;
  /** Classes additionnelles */
  className?: string;
};

// Map taille → dimensions en px
const SIZE_MAP: Record<ProfileSize, { avatar: number; ring: number }> = {
  sm: { avatar: 40, ring: 44 },
  md: { avatar: 56, ring: 60 },
  lg: { avatar: 72, ring: 76 },
};

/**
 * Tronque "Andrey Rublev" → "A. Rublev".
 * Gère les cas :
 *   - Nom vide → ""
 *   - Un seul mot → inchangé (ex: "Björn")
 *   - Prénom composé → premier token uniquement (ex: "Jean-Pierre" → "J.")
 *   - Nom à plus de 2 tokens → premier token + dernier token
 */
export function truncateName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/\s+/);

  // Un seul mot → on le retourne tel quel
  if (parts.length === 1) return parts[0];

  // Premier token (prénom) → première lettre majuscule + point
  const firstName = parts[0];
  // Prendre la première lettre réelle (ignore diacritiques pour le trim)
  const initial = firstName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")[0]
    ?.toUpperCase() ?? "?";

  // Dernier token (nom de famille)
  const lastName = parts[parts.length - 1];

  return `${initial}. ${lastName}`;
}

/**
 * Extrait les initiales pour le fallback Avatar.
 * "Andrey Rublev" → "AR"
 * "Naomi Osaka" → "NO"
 * "Jannik Sinner" → "JS"
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0))
    .toUpperCase();
}

export function PlayerProfileHeader({
  name,
  photoUrl,
  color = "#6366f1",
  size = "lg",
  priority = false,
  className,
}: Props) {
  const dims = SIZE_MAP[size];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {/* Anneau lumineux arrière-plan */}
      {color && (
        <div
          className="pointer-events-none absolute -inset-[2px] rounded-full opacity-20"
          style={{ background: color }}
          aria-hidden
        />
      )}

      {/* Avatar Radix avec fallback initiales */}
      <Avatar
        className="relative ring-2 ring-offset-2 ring-offset-background"
        style={{
          width: dims.avatar,
          height: dims.avatar,
          "--tw-ring-color": color,
        } as React.CSSProperties}
      >
        <AvatarImage
          src={photoUrl ?? undefined}
          alt={name}
          className="object-cover"
          // priority: signale à Next/RSC de ne pas lazy-loader
          loading={priority ? "eager" : "lazy"}
          // @ts-expect-error fetchpriority est un attribut HTML standard
          fetchpriority={priority ? "high" : "auto"}
        />
        <AvatarFallback
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          style={{ backgroundColor: `${color}15` }}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
