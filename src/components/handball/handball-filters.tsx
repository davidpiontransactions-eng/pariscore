"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { sortHandballLeagueEntries } from "@/lib/handball-leagues";
import { HandballLeaguePopover } from "./handball-league-popover";

/**
 * Filtre championnats de l'onglet handball (calendrier).
 *
 * Adaptateur fin sur le composant partagé HandballLeaguePopover
 * (déclencheur unique + popover recherche/liste à ascenseur) — le contrat de
 * props avec le parent (`handball-tab-content`) est strictement conservé :
 * tri 1xbet (ligues majeures puis volume) toujours appliqué ici.
 */
export function HandballFilters({
  matches,
  selected,
  onSelect,
}: {
  matches: HandballMatch[];
  selected: string | null;
  onSelect: (l: string | null) => void;
}) {
  const leagues = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches)
      map.set(m.league.name, (map.get(m.league.name) || 0) + 1);
    // Tri 1xbet : ligues majeures en tête (tier), puis volume
    return sortHandballLeagueEntries(
      [...map.entries()].map(([name, count]) => ({ name, count })),
    );
  }, [matches]);

  return (
    <HandballLeaguePopover
      leagues={leagues}
      total={matches.length}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
