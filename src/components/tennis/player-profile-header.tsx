"use client";

/**
 * PlayerProfileHeader — Avatar + nom tronqué "A. Rublev"
 *
 * Migré vers `<PlayerAvatar />` (next/image, fallback unifié, badge pays).
 * Conserve l'API publique existante pour la rétro-compatibilité.
 *
 * Utilisation :
 *   <PlayerProfileHeader
 *     name="Andrey Rublev"
 *     photoUrl="https://..."
 *     color="#B91C1C"
 *     size="lg"
 *     countryCode="RU"
 *   />
 */

import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/ui/player-avatar";

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
  /** Code pays ISO (optionnel — badge drapeau) */
  countryCode?: string | null;
  /** Image prioritaire (loading eager + fetchPriority high) pour LCP */
  priority?: boolean;
  /** Classes additionnelles */
  className?: string;
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
  countryCode,
  priority = false,
  className,
}: Props) {
  return (
    <PlayerAvatar
      name={name}
      photoUrl={photoUrl}
      color={color}
      size={size}
      countryCode={countryCode}
      priority={priority}
      className={className}
    />
  );
}
