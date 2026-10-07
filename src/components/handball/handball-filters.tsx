"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { countHandballLeagues, sortHandballLeagueEntries } from "@/lib/handball-leagues";
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
  scope,
  selected,
  onSelect,
}: {
  /** Matchs servant à ÉNUMÉRER les ligues (liste complète, jamais amputée). */
  matches: HandballMatch[];
  /**
   * Matchs servant à COMPTER (défaut : `matches`). Le parent y passe la journée
   * affichée par le calendrier, sinon le déclencheur annonçait le volume de
   * TOUTE la fenêtre (« Tous les championnats (579) ») au lieu du contenu du
   * jour sélectionné.
   */
  scope?: HandballMatch[];
  selected: string | null;
  onSelect: (l: string | null) => void;
}) {
  // country = pays du 1er match trouvé (clé de drapeau du badge) ; count =
  // volume sur le périmètre `scope`. Tri 1xbet : ligues majeures en tête.
  const leagues = useMemo(
    () => sortHandballLeagueEntries(countHandballLeagues(matches, scope ?? matches)),
    [matches, scope],
  );
  const total = useMemo(() => leagues.reduce((s, l) => s + l.count, 0), [leagues]);

  return (
    <HandballLeaguePopover
      leagues={leagues}
      total={total}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
