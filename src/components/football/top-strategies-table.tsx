"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { StrategyTop5Key } from "@/lib/football-strategy-top5";
import type { MatchPick } from "@/lib/services/football-analytics";

export type StrategyTableRow = {
  matchId: string;
  league?: string | null;
  leagueLogo?: string | null;
  kickoff: string;
  home: { teamName: string; logo?: string };
  away: { teamName: string; logo?: string };
  value: number;
  odds?: number | null;
  trend?: "up" | "down" | "flat";
};

type Props = {
  rows: StrategyTableRow[];
  strategy: StrategyTop5Key;
  picksByMatch?: Record<string, MatchPick[]>;
};

function confidenceBand(prob: number): { label: string; cls: string } {
  if (prob >= 0.7) return { label: "Confiance Élevée", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (prob >= 0.6) return { label: "Confiance Moyenne", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "Faible", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3 w-3 text-emerald-400" />;
  if (trend === "down") return <ArrowDown className="h-3 w-3 text-rose-400" />;
  return <Minus className="h-3 w-3 text-slate-500" />;
}

export function TopStrategiesTable({ rows, strategy, picksByMatch }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
        Aucun match ne satisfait cette stratégie aujourd'hui.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-4 py-3">Match</th>
            <th className="px-4 py-3">Probabilite</th>
            <th className="px-4 py-3">Cote</th>
            <th className="px-4 py-3">EV</th>
            <th className="px-4 py-3">Tendance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((row) => {
            const picks = picksByMatch?.[row.matchId] ?? [];
            const topPick = picks[0];
            const band = topPick ? confidenceBand(topPick.prob) : null;
            return (
              <tr key={row.matchId} className="transition-colors hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.leagueLogo && (
                      <img src={row.leagueLogo} alt="" className="h-4 w-4 rounded object-contain" />
                    )}
                    <div>
                      <div className="font-medium text-slate-100">
                        {row.home.teamName} <span className="text-slate-500">vs</span> {row.away.teamName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.league} · {row.kickoff}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {band && (
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", band.cls)}>
                      {Math.round(topPick.prob * 100)}% · {band.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">
                  {row.odds != null ? row.odds.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {topPick?.ev != null ? (
                    <span className={cn("font-mono text-xs", topPick.ev > 0 ? "text-emerald-400" : "text-rose-400")}>
                      {topPick.ev > 0 ? "+" : ""}{(topPick.ev * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TrendIcon trend={row.trend} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
