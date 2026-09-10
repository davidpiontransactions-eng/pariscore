"use client";

import { useCallback, useRef, useState } from "react";
import {
  TennisTop10MatchesWidget,
  type TopFocus,
} from "@/components/tennis/tennis-top10-matches-widget";
import { TennisCalendarSection } from "@/components/tennis/tennis-calendar-section";
import type { FotmobCalMatch, TopStratTag } from "@/components/football/fotmob-calendar-table";
import {
  TENNIS_STRATEGY_DEFS,
  type TennisStrategyKey,
} from "@/lib/tennis-strategy-top10";

/**
 * Vue "Stratégies" (sous-onglet calendar) — section calendrier FotMob +
 * Top 10 par stratégie. Clic pill → table Top affichée avec le match
 * et la stratégie (scroll + highlight).
 */
export function TennisCalendarStrategyView() {
  const [focused, setFocused] = useState<TopFocus | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Clic pill → table Top affichée avec le match et la stratégie.
  const handleTopPillSelect = useCallback((m: FotmobCalMatch, tag: TopStratTag) => {
    const skey = tag.key as TennisStrategyKey;
    if (!TENNIS_STRATEGY_DEFS.some((d) => d.key === skey)) return;
    setFocused({ matchId: m.id, strat: skey, nonce: Date.now() });
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div ref={topRef} className="scroll-mt-4">
        <TennisTop10MatchesWidget focused={focused} />
      </div>

      <TennisCalendarSection onTopPillSelect={handleTopPillSelect} />
    </div>
  );
}
