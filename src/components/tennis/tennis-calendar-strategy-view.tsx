"use client";

import { useCallback, useRef, useState } from "react";
import {
  TennisTop10MatchesWidget,
  type TopFocus,
} from "@/components/tennis/tennis-top10-matches-widget";
import { TennisCalendarSection } from "@/components/tennis/tennis-calendar-section";
import { TennisBacktestMatrix } from "@/components/tennis/tennis-backtest-matrix";
import type { FotmobCalMatch, TopStratTag } from "@/components/football/fotmob-calendar-table";
import {
  TENNIS_STRATEGY_DEFS,
  type TennisStrategyKey,
} from "@/lib/tennis-strategy-top10";
import { cn } from "@/lib/utils";

/** Sous-vues de l'onglet calendrier tennis : calendrier usuel ou backtest. */
type CalendarView = "cal" | "bt";

/**
 * Vue "Stratégies" (sous-onglet calendar) — 2 onglets :
 *   📅 Calendrier & Top 10 — section calendrier FotMob + Top 10 par stratégie
 *      (clic pill → table Top affichée avec le match + scroll/highlight) ;
 *   📈 Backtesting Stratégies / Type de marché — matrice 9 marchés 1xbet
 *      × segments (surface, H/F, type de tournoi, bande de cote).
 * Mobile & desktop : mêmes composants, rendus responsifs.
 */
export function TennisCalendarStrategyView() {
  const [focused, setFocused] = useState<TopFocus | null>(null);
  const [view, setView] = useState<CalendarView>("cal");
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

  const tabs: ReadonlyArray<{ id: CalendarView; full: string; short: string }> = [
    { id: "cal", full: "Calendrier & Top 10", short: "Calendrier" },
    { id: "bt", full: "Backtesting Stratégies / Type de marché", short: "Backtesting" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      {/* Bascule de vues (onglets) */}
      <div
        role="tablist"
        aria-label="Vues du calendrier tennis"
        className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-1"
      >
        {tabs.map((t) => {
          const isActive = view === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden="true">{t.id === "cal" ? "📅" : "📈"}</span>
              <span className="hidden sm:inline">{t.full}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          );
        })}
      </div>

      {view === "cal" ? (
        <>
          <div ref={topRef} className="scroll-mt-4">
            <TennisTop10MatchesWidget focused={focused} />
          </div>

          <TennisCalendarSection onTopPillSelect={handleTopPillSelect} />
        </>
      ) : (
        <TennisBacktestMatrix />
      )}
    </div>
  );
}
