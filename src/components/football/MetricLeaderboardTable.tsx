"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import type { MetricRankings, MetricRankingRow } from "@/lib/football-data";

const METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "ppg-home", label: "PPG (Domicile)" },
  { key: "ppg-away", label: "PPG (Extérieur)" },
  { key: "goals-scored-home", label: "Buts Marqués (Dom)" },
  { key: "goals-scored-away", label: "Buts Marqués (Ext)" },
  { key: "goals-conceded-home", label: "Buts Encaissés (Dom)" },
  { key: "goals-conceded-away", label: "Buts Encaissés (Ext)" },
  { key: "goals-avg-home", label: "Moy. Buts/Match (Dom)" },
  { key: "goals-avg-away", label: "Moy. Buts/Match (Ext)" },
];

type Props = {
  rankings: MetricRankings;
  homeTeamName: string;
  awayTeamName: string;
};

export function MetricLeaderboardTable({ rankings, homeTeamName, awayTeamName }: Props) {
  const [selected, setSelected] = useState(METRIC_OPTIONS[0].key);
  const rows: MetricRankingRow[] = rankings[selected] ?? [];

  const homeKey = homeTeamName.trim().toLowerCase().replace(/\s+/g, " ");
  const awayKey = awayTeamName.trim().toLowerCase().replace(/\s+/g, " ");

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/40">
      <div className="flex items-center gap-1 border-b border-border/40 bg-muted/30 px-2 py-1">
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 bg-transparent text-[11px] font-medium text-foreground outline-none"
        >
          {METRIC_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground/50">Saison complète</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="border-b border-border/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-1.5 py-1 text-right">#</th>
              <th className="px-1 py-1 text-left">Équipe</th>
              <th className="w-16 px-1 py-1 text-right tabular-nums">Val.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.map((r) => {
              const key = r.name.trim().toLowerCase().replace(/\s+/g, " ");
              const isHome = key === homeKey;
              const isAway = key === awayKey;
              return (
                <tr
                  key={r.rank}
                  className={cn(
                    "hover:bg-muted/20",
                    isHome && "bg-emerald-500/10",
                    isAway && "bg-rose-500/10"
                  )}
                >
                  <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.rank}</td>
                  <td className="flex items-center gap-1 px-1 py-1 font-medium">
                    <span className="truncate">{r.name}</span>
                    {isHome && (
                      <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-px text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        [H]
                      </span>
                    )}
                    {isAway && (
                      <span className="shrink-0 rounded bg-rose-500/20 px-1 py-px text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        [A]
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {r.value != null ? r.value.toFixed(2) : "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
