"use client";

import { useCallback, useState } from "react";
import type { LeagueFilter } from "@/lib/baseball/types";
import { useBaseballSchedule } from "@/lib/hooks/use-baseball";
import { dayLabel, shiftIsoDate, todayParisIso } from "@/lib/baseball/timezone";
import { BaseballMatchSchedule } from "./BaseballMatchSchedule";
import { BaseballMatchAnalysisModal } from "./BaseballMatchAnalysisModal";

const LEAGUE_TABS: { id: LeagueFilter; label: string }[] = [
  { id: "ALL", label: "Tous" },
  { id: "MLB", label: "MLB 🇺🇸" },
  { id: "KBO", label: "KBO 🇰🇷" },
  { id: "NPB", label: "NPB 🇯🇵" },
  { id: "CPBL", label: "CPBL 🇹🇼" },
  { id: "LMB", label: "LMB 🇲🇽" },
  { id: "LIDOM", label: "LIDOM 🇩🇴" },
  { id: "LVBP", label: "LVBP 🇻🇪" },
];

const WEEK_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

export function MLBKBOFolderTab() {
  const [league, setLeague] = useState<LeagueFilter>("ALL");
  const [date, setDate] = useState<string>(() => todayParisIso());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useBaseballSchedule(date, league);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  const today = todayParisIso();

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-5">
      {/* Contrôles : ligues + navigation date */}
      <div className="sticky top-0 z-40 -mx-3 border-b border-slate-800 bg-[#0b0e14]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {LEAGUE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLeague(t.id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  league === t.id
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
              title="Rafraîchir la slate (cache serveur)"
            >
              ⟳ {isLoading ? "..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setDate(shiftIsoDate(date, -1))}
              aria-label="Jour précédent"
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setDate(today)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                date === today
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => setDate(shiftIsoDate(date, 1))}
              aria-label="Jour suivant"
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              →
            </button>
          </div>
        </div>

        {/* Bande des 7 jours */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK_OFFSETS.map((offset) => {
            const d = shiftIsoDate(date, offset);
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                className={`rounded-lg border px-1 py-2 text-center transition-colors ${
                  active
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-slate-800 bg-[#11161f] hover:border-slate-600"
                }`}
              >
                <div
                  className={`text-[9px] font-bold uppercase tracking-wide ${
                    active ? "text-amber-300" : "text-slate-500"
                  }`}
                >
                  {offset === 0 ? "Auj." : dayLabel(d).split(" ")[0]}
                </div>
                <div
                  className={`font-mono text-xs font-bold tabular-nums ${
                    active ? "text-white" : "text-slate-400"
                  }`}
                >
                  {d.slice(8, 10)}.{d.slice(5, 7)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compteur slate */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-white">
          ⚾ Calendrier <span className="text-amber-300">{dayLabel(date)}</span>
        </h2>
        {data && (
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-400">
            {data.matches.length} match{data.matches.length > 1 ? "s" : ""} ·{" "}
            {data.degraded ? "mode dégradé (API MLB KO)" : "API live OK"}
          </span>
        )}
        {error && (
          <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
            Erreur réseau — réessayez
          </span>
        )}
      </div>

      {/* Grille de matchs */}
      <div className="mt-3">
        <BaseballMatchSchedule
          date={date}
          matches={data?.matches ?? []}
          isLoading={isLoading}
          degraded={data?.degraded ?? false}
          onOpenMatch={setSelectedMatchId}
        />
      </div>

      {selectedMatchId && (
        <BaseballMatchAnalysisModal
          matchId={selectedMatchId}
          onClose={() => setSelectedMatchId(null)}
        />
      )}
    </div>
  );
}
