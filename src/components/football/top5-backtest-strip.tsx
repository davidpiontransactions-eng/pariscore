"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import type { Top5Sport, Top5BacktestEntry, StrategyBacktestStats } from "@/lib/top5-backtest/types";
import { aggregateByLeague } from "@/lib/top5-backtest/types";
import { useTop5Backtest } from "@/hooks/use-football-top5-backtest";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const isValide = (s: StrategyBacktestStats) =>
  s.roi.roiPct != null && s.roi.roiPct >= 5 && s.roi.nWithOdds >= 30;

/**
 * Bandeau backtest des widgets Top 5 (foot + tennis) : réussite / ROI de la
 * stratégie active sur l'historique des top 5 journaliers (settle quotidien).
 * Cliquable pour déplier les 10 derniers picks réglés.
 */
function LeagueTab({
  strategyKey,
  entries,
}: {
  strategyKey: string;
  entries: Top5BacktestEntry[];
}) {
  const leagueStats = aggregateByLeague(entries, strategyKey);
  const sorted = Object.entries(leagueStats).sort(
    (a, b) => (b[1].roi.roiPct ?? -Infinity) - (a[1].roi.roiPct ?? -Infinity),
  );

  if (sorted.length === 0) {
    return <p className="px-1 py-0.5 text-[9px] text-slate-500">Aucune donnée par championnat.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-500">
            <th className="px-1 py-0.5 font-medium">Ligue</th>
            <th className="px-1 py-0.5 text-right font-medium">N</th>
            <th className="px-1 py-0.5 text-right font-medium">WR%</th>
            <th className="px-1 py-0.5 text-right font-medium">ROI%</th>
            <th className="px-1 py-0.5 text-center font-medium">Validé</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([league, s]) => (
            <tr key={league} className="border-b border-slate-800/50">
              <td className="max-w-[120px] truncate px-1 py-0.5 text-slate-300">{league}</td>
              <td className="px-1 py-0.5 text-right tabular-nums text-slate-400">{s.n}</td>
              <td className="px-1 py-0.5 text-right tabular-nums text-slate-400">
                {s.winRatePct != null ? `${s.winRatePct.toFixed(0)}%` : "—"}
              </td>
              <td
                className={cn(
                  "px-1 py-0.5 text-right font-bold tabular-nums",
                  (s.roi.roiPct ?? 0) >= 0 ? "text-emerald-300" : "text-red-400",
                )}
              >
                {s.roi.roiPct != null ? `${s.roi.roiPct > 0 ? "+" : ""}${s.roi.roiPct.toFixed(1)}%` : "—"}
              </td>
              <td className="px-1 py-0.5 text-center">
                {isValide(s) && (
                  <Badge className="border-emerald-600 bg-emerald-600/20 text-[8px] text-emerald-300">
                    ✓
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
        {isValide(stats) && (
          <Badge className="ml-1 border-emerald-600 bg-emerald-600/20 text-[9px] text-emerald-300">
            ✓ Validé
          </Badge>
        )}
        <span className="ml-auto shrink-0" aria-hidden>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>

      {open && (
        <Tabs defaultValue="recents" className="mt-1">
          <div className="rounded border border-slate-800 bg-slate-950/80 p-1">
            <TabsList className="mb-1 h-6 w-full">
              <TabsTrigger value="recents" className="h-5 px-2 text-[9px]">
                Récents
              </TabsTrigger>
              <TabsTrigger value="league" className="h-5 px-2 text-[9px]">
                Par championnat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recents" className="mt-0">
              {picks.length === 0 ? (
                <p className="px-1 py-0.5 text-[9px] text-slate-500">Aucun pick réglé pour cette stratégie.</p>
              ) : (
                <ul className="space-y-px">
                  {picks.map((e) => (
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
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="league" className="mt-0">
              <LeagueTab strategyKey={strategyKey} entries={summary?.recent ?? ([] as Top5BacktestEntry[])} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
