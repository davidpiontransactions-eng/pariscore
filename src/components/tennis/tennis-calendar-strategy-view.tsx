"use client";

import { useCallback, useMemo, useState } from "react";
import { TennisTop10MatchesWidget } from "@/components/tennis/tennis-top10-matches-widget";
import {
  FotmobCalendarTable,
  type FotmobCalMatch,
} from "@/components/football/fotmob-calendar-table";
import type { TennisStrategyEntry } from "@/lib/tennis-strategy-top10";

/** Mappe une entrée Top10 vers le format calendrier (pas de pays : logo null). */
function entryToCalMatch(e: TennisStrategyEntry): FotmobCalMatch {
  return {
    id: e.matchId,
    scheduledAt: e.scheduledAt,
    home: { name: e.playerA.shortName || e.playerA.name, logo: null },
    away: { name: e.playerB.shortName || e.playerB.name, logo: null },
    league: { name: e.tournament, country: null, logo: null },
    round: e.round,
    live: null,
  };
}

/**
 * Vue "Stratégies" (sous-onglet calendar) — calendrier FotMob des matchs
 * qualifiés + Top 10 matchs par stratégie de pari. Les deux restent
 * synchronisés (stratégie + fenêtre) via le widget.
 */
export function TennisCalendarStrategyView() {
  const [entries, setEntries] = useState<TennisStrategyEntry[]>([]);
  const handleEntries = useCallback((ents: TennisStrategyEntry[]) => setEntries(ents), []);
  const calMatches = useMemo(() => entries.map(entryToCalMatch), [entries]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      {calMatches.length > 0 && <FotmobCalendarTable matches={calMatches} />}
      <TennisTop10MatchesWidget onEntries={handleEntries} />
    </div>
  );
}
