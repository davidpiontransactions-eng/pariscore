"use client";

import { TennisTop10MatchesWidget, type TopFocus } from "@/components/tennis/tennis-top10-matches-widget";

type Props = {
  /**
   * Focus externe : match + stratégie à surligner. Piloté par le parent, qui le
   * reçoit du clic sur une pastille « Top » du calendrier puis bascule sur ce
   * sous-onglet. `null` = aucun surlignage.
   */
  focused?: TopFocus | null;
};

/**
 * Panneau « TOP 10 Matchs » — tableau des meilleures opportunités par
 * stratégie de pari.
 *
 * Enveloppe `TennisTop10MatchesWidget`, qui porte déjà ses filtres (stratégie,
 * tournoi, surface, catégorie, fenêtre temporelle) et son état de chargement.
 */
export function TennisTop10Panel({ focused = null }: Props = {}) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <TennisTop10MatchesWidget focused={focused} />
    </div>
  );
}