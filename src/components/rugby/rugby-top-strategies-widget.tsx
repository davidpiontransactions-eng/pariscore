"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useRugbyTopStrategies } from "@/hooks/use-rugby-top-strategies";
import { RUGBY_STRATEGIES, type RugbyStrategyKey } from "@/lib/rugby-strategy-top";
import { RugbyTopStrategiesTable } from "./rugby-top-strategies-table";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import {
  filterByStartWindow,
  filterByToday,
  filterByTomorrow,
  parseTimeFilter,
  type TimeFilterKey,
} from "@/lib/match-view";

/* Teintes FotMob clair */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  time: "#717171",
  accent: "#00985f",
} as const;

export function RugbyTopStrategiesWidget() {
  const [active, setActive] = useState<RugbyStrategyKey>("homeWin");
  const [timeKey, setTimeKey] = useState<TimeFilterKey>("all");
  const def = RUGBY_STRATEGIES.find((s) => s.key === active) ?? RUGBY_STRATEGIES[0];
  const { matches: rawMatches, loading } = useRugbyTopStrategies(active, 10, timeKey);

  // Filtre horaire & date (côté client, sur le kickoff)
  const { hours: timeRange, today: timeToday, tomorrow: timeTomorrow } = parseTimeFilter(timeKey);
  const matches = useMemo(() => {
    let filtered = rawMatches;
    if (timeToday) {
      filtered = filterByToday(filtered, (m) => m.kickoff);
    } else if (timeTomorrow) {
      filtered = filterByTomorrow(filtered, (m) => m.kickoff);
    }
    filtered = filterByStartWindow(filtered, timeRange, (m) => m.kickoff);
    return filtered;
  }, [rawMatches, timeRange, timeToday, timeTomorrow]);

  return (
    <div
      className="rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      {/* Header avec titre + sélecteur stratégie */}
      <div
        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: C.headerBg, borderBottom: `1px solid ${C.cardBorder}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold" style={{ color: C.headerText }}>
            🏉 Top 10 matchs par stratégie
          </span>
        </div>

        {/* Sélecteur stratégie */}
        <div className="flex flex-wrap gap-1.5">
          {RUGBY_STRATEGIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition-colors",
                active === s.key
                  ? "bg-[#00985f]/15 text-[#00985f] border border-[#00985f]/30"
                  : "bg-[#f5f5f5] text-[#717171] border border-[#e0e0e0] hover:bg-[#e8e8e8]",
              )}
            >
              <span>{s.emoji}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtre horaire & date */}
      <div className="px-4 py-2" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
        <TimeRangeFilter value={timeKey} onChange={setTimeKey} />
      </div>

      {/* Description stratégie */}
      <div className="px-4 py-2 text-[12px]" style={{ color: C.time, borderBottom: `1px solid ${C.cardBorder}` }}>
        {def.emoji} {def.label} — {def.isProb
          ? "Classement par probabilité décroissante"
          : def.key === "bestDefense"
            ? "Classement par lambda encaissé croissant (meilleure défense en haut)"
            : "Classement par score attendu décroissant (attaque la plus forte en haut)"}
      </div>

      {/* Contenu */}
      <div className="p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl"
                style={{ height: 56, backgroundColor: "#f5f5f5" }}
              />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[13px]" style={{ color: C.time }}>
            <span className="text-2xl mb-2">🏉</span>
            Aucun match dans ce créneau.
          </div>
        ) : (
          <RugbyTopStrategiesTable
            rows={matches}
            strategy={active}
            format={def.format}
          />
        )}
      </div>
    </div>
  );
}
