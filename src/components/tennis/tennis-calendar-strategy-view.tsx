"use client";

import { TennisTop10MatchesWidget } from "@/components/tennis/tennis-top10-matches-widget";

/**
 * Vue "Stratégies" (sous-onglet calendar) — calendrier + Top 10 matchs par
 * stratégie de pari. Le widget embarque son propre fetch (/api/tennis/strategy-top10)
 * et ses sélecteurs (stratégie + fenêtre aujourd'hui/demain/tout).
 */
export function TennisCalendarStrategyView() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <TennisTop10MatchesWidget />
    </div>
  );
}
