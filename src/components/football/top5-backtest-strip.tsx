"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import type { Top5Sport } from "@/lib/top5-backtest/types";
import { useTop5Backtest } from "@/hooks/use-football-top5-backtest";
import { cn } from "@/lib/utils";

/**
 * Bandeau backtest des widgets Top 5 (foot + tennis) : réussite / ROI de la
 * stratégie active sur l'historique des top 5 journaliers (settle quotidien).
 * Cliquable pour déplier les 10 derniers picks réglés.
 */
export function Top5BacktestStrip({
  sport = "football",
  strategyKey,
}: {
  sport?: Top5Sport;
  strategyKey: string;
}) {
  const { summary } = useTop5Backtest(sport);
  const [open, setOpen] = useState(false);
  const stats = summary?.strategies?.[strategyKey];

  if (!stats || stats.n === 0) return null;

  const wr = stats.winRatePct != null ? `${stats.winRatePct.toFixed(0)} %` : "—";
  const roi =
    stats.roi.roiPct != null
      ? `${stats.roi.roiPct > 0 ? "+" : ""}${stats.roi.roiPct.toFixed(1)} %`
      : "—";
  const streakTxt =
    stats.currentStreak !== 0 ? ` · série ${stats.currentStreak > 0 ? "+" : ""}${stats.currentStreak}` : "";
  const picks = (summary?.recent ?? []).filter((e) => e.strategyKey === strategyKey).slice(0, 10);

  return (
    <div className="px-2.5 pb-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={`Historique des top 5 : ${stats.n} picks, ${stats.wins} gagnés, ${stats.pending} en cours${streakTxt}`}
        className="flex w-full items-center gap-1 rounded border border-slate-800 bg-slate-900/60 px-1.5 py-1 text-left text-[9px] text-slate-400 transition-colors hover:border-slate-700"
      >
        <FlaskConical className="h-2.5 w-2.5 shrink-0 text-emerald-400" aria-hidden />
        <span className="font-bold uppercase tracking-wider text-slate-500">Backtest</span>
        <span className="tabular-nums">
          {stats.n} picks · WR{" "}
          <span className={cn("font-bold", (stats.winRatePct ?? 0) >= 50 ? "text-emerald-300" : "text-amber-300")}>
            {wr}
          </span>
          {" · "}
          ROI{" "}
          <span className={cn("font-bold tabular-nums", (stats.roi.roiPct ?? 0) >= 0 ? "text-emerald-300" : "text-red-400")}>
            {roi}
          </span>
          {streakTxt}
        </span>
        <span className="ml-auto shrink-0" aria-hidden>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>

      {open && (
        <ul className="mt-1 space-y-px rounded border border-slate-800 bg-slate-950/80 p-1">
          {picks.length === 0 ? (
            <li className="px-1 py-0.5 text-[9px] text-slate-500">Aucun pick réglé pour cette stratégie.</li>
          ) : (
            picks.map((e) => (
              <li key={e.id} className="flex items-center gap-1 px-1 py-0.5 text-[9px] leading-tight">
                <span className="w-11 shrink-0 tabular-nums text-slate-600">{e.kickoff.slice(5, 10)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{e.pickDesc}</span>
                <span className="shrink-0 tabular-nums text-slate-600">{e.score}</span>
                <span
                  className={cn(
                    "w-4 shrink-0 rounded text-center font-bold",
                    e.status === "won" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-400",
                  )}
                  aria-label={e.status === "won" ? "gagné" : "perdu"}
                >
                  {e.status === "won" ? "V" : "X"}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
