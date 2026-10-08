"use client";

import { CalendarDays } from "lucide-react";
import { TennisCalendarSection } from "@/components/tennis/tennis-calendar-section";
import type { TopFocus } from "@/components/tennis/tennis-top10-matches-widget";
import type { FotmobCalMatch, TopStratTag } from "@/components/football/fotmob-calendar-table";
import {
  TENNIS_STRATEGY_DEFS,
  type TennisStrategyKey,
} from "@/lib/tennis-strategy-top10";
import { useCallback } from "react";

type Props = {
  /**
   * Bascule vers le sous-onglet « TOP 10 Matchs » — le parent la fournit.
   * Clic sur une pastille « Top » du calendrier = « montre-moi ce match dans le
   * tableau » : sans cette bascule l'utilisateur resterait sur le calendrier
   * sans jamais voir ce qu'il a demandé.
   */
  onFocusTop10: (focus: TopFocus) => void;
};

/**
 * Panneau « Calendrier » — calendrier FotMob + bascule Top 10.
 *
 * Enveloppe `TennisCalendarSection` (il porte déjà son état : date, fenêtre
 * horaire, En direct, Top, recherche, et son skeleton). Aucun nouveau fetch :
 * le calendrier charge ses propres données.
 */
export function TennisCalendarPanel({ onFocusTop10 }: Props) {
  const handleTopPillSelect = useCallback(
    (m: FotmobCalMatch, tag: TopStratTag) => {
      const skey = tag.key as TennisStrategyKey;
      if (!TENNIS_STRATEGY_DEFS.some((d) => d.key === skey)) return;
      onFocusTop10({ matchId: m.id, strat: skey, nonce: Date.now() });
    },
    [onFocusTop10],
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <TennisCalendarSection onTopPillSelect={handleTopPillSelect} />
    </div>
  );
}

export { CalendarDays };