"use client";

import { TeamLogo } from "./TeamLogo";

/**
 * TeamLogoImage — composant de rendu logos CS2 alimenté par le cache VPS.
 *
 * Priorité d'affichage :
 *   1. logo_local  → URL locale servie par `/cache/cs2-teams/` (cache disque VPS)
 *   2. logo        → URL distante (BSD/Liquipedia) en attendant la mise en cache
 *   3. (échec img) → badge d'initiales stylisé + couleur dominante (TeamLogo)
 *
 * Délègue le rendu visuel (tailles, flag pays, fallback) à TeamLogo : source
 * unique de vérité pour l'apparence.
 */

type Size = "sm" | "md" | "lg";

type Props = {
  name: string;
  logo?: string | null;
  logo_local?: string | null;
  country?: string | null;
  size?: Size;
  className?: string;
};

export function TeamLogoImage({
  name,
  logo,
  logo_local,
  country,
  size,
  className,
}: Props) {
  return (
    <TeamLogo
      name={name}
      logo={logo_local ?? logo}
      country={country}
      size={size}
      className={className}
    />
  );
}