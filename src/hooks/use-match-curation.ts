"use client";

import { useMemo } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import { getWeekMarquee, isMarqueeTournament, type WeeklyMarqueeConfig } from "@/lib/weekly-marquee";

/**
 * `useMatchCuration` — sépare les matchs "À la une" (tournois phares de la
 * semaine) du reste de la liste. Utilisé par `tennis-tab-content.tsx` pour
 * afficher un carrousel dédié en haut d'affiche (R8 curation).
 *
 * La curation est ORTHOGONALE au tri : elle prend en entrée une liste
 * déjà triée (sortie de `useMatchFilter.filtered`) et la scinde en 2
 * listes ordonnées {featured, rest}. L'ordre relatif au sein de chaque
 * liste est préservé.
 *
 * @param sortedMatches Liste déjà triée (sortie de useMatchFilter)
 * @param marquee Config marquee (defaults to current week)
 * @returns {featured, rest, hasFeatured}
 */
export type CurationResult = {
  /** Matchs des tournois phares de la semaine (ordre préservé). */
  featured: TennisMatch[];
  /** Reste des matchs (ordre préservé). */
  rest: TennisMatch[];
  /** True si ≥1 match featured (pour afficher/masquer la section). */
  hasFeatured: boolean;
  /** Config marquee utilisée (pour afficher le titre de section). */
  marquee: WeeklyMarqueeConfig;
};

export function useMatchCuration(
  sortedMatches: TennisMatch[],
  marquee?: WeeklyMarqueeConfig,
): CurationResult {
  const effectiveMarquee = marquee ?? getWeekMarquee();
  // Clé de dédépendance stable pour le useMemo (sinon eslint refuse .join()).
  const marqueeKey = effectiveMarquee.tournamentNames.join("|");

  return useMemo(() => {
    if (effectiveMarquee.tournamentNames.length === 0) {
      return {
        featured: [],
        rest: sortedMatches,
        hasFeatured: false,
        marquee: effectiveMarquee,
      };
    }

    const featured: TennisMatch[] = [];
    const rest: TennisMatch[] = [];

    for (const m of sortedMatches) {
      if (isMarqueeTournament(m.tournament)) {
        featured.push(m);
      } else {
        rest.push(m);
      }
    }

    return {
      featured,
      rest,
      hasFeatured: featured.length > 0,
      marquee: effectiveMarquee,
    };
  }, [sortedMatches, marqueeKey, effectiveMarquee]);
}
