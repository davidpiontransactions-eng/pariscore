"use client";

import { useMemo } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  FotmobCalendarTable,
  type FotmobCalMatch,
} from "@/components/football/fotmob-calendar-table";
import { countryFlag } from "@/lib/bsd-football-fetcher";

/**
 * Wrapper calendrier tennis — mappe TennisMatch[] (format prematch BSD)
 * vers FotmobCalMatch[] attendu par le composant générique FotmobCalendarTable.
 *
 * Adaptations tennis :
 *   - playerA → home, playerB → away (pas de "domicile" au tennis)
 *   - tournoi → league.name
 *   - drapeau pays du joueur (countryFlag) au lieu du logo club
 *   - pas de live sur les matchs prematch (live = null)
 */

export interface TennisCalendarWrapperProps {
  matches: TennisMatch[];
  onSelectMatch?: (matchId: string) => void;
}

function toCalMatch(m: TennisMatch): FotmobCalMatch {
  return {
    id: m.id,
    scheduledAt: m.scheduledAt,
    home: {
      name: m.playerA.shortName || m.playerA.name,
      logo: m.playerA.country ? countryFlag(m.playerA.country) : null,
    },
    away: {
      name: m.playerB.shortName || m.playerB.name,
      logo: m.playerB.country ? countryFlag(m.playerB.country) : null,
    },
    league: {
      name: m.tournament ?? "Tournoi",
      country: null,
      logo: null,
    },
    round: m.round ?? null,
    live: null,
  };
}

export function TennisCalendarWrapper({ matches, onSelectMatch }: TennisCalendarWrapperProps) {
  const calMatches = useMemo(() => matches.map(toCalMatch), [matches]);

  return (
    <FotmobCalendarTable
      matches={calMatches}
      onSelectMatch={onSelectMatch ? (m) => onSelectMatch(m.id) : undefined}
    />
  );
}
