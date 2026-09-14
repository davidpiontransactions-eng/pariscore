"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * StandingsTable — Tableau de classement complet style statshub.com.
 * 13 colonnes : #, Team, P, W, D, L, GF, GA, +/-, Pts, xG, xGA, Form.
 * Form badges colorés (W=#00985f, D=#8D9499, L=#DD3636), hover highlight.
 * Tri asc/desc sur clic header.
 */

export type StandingRow = {
  rank: number;
  team: string;
  shortName?: string;
  logo?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  xG?: number;
  xGA?: number;
  form?: string[]; // ex. ["W", "D", "L", "W", "W"]
  ppg?: number;
};

type Props = {
  rows: StandingRow[];
  className?: string;
};

const FORM_COLORS: Record<string, string> = {
  W: "bg-[#00985f] text-white",
  D: "bg-[#8D9499] text-white",
  L: "bg-[#DD3636] text-white",
};

function FormBadge({ result }: { result: string }) {
  const upper = result.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[10px] font-bold leading-none",
        FORM_COLORS[upper] ?? "bg-zinc-700 text-zinc-300",
      )}
    >
      {upper === "W" ? "1" : upper === "D" ? "N" : "0"}
    </span>
  );
}

function formStreak(form?: string[]): string | null {
  if (!form || form.length === 0) return null;
  const last = form[form.length - 1]?.toUpperCase();
  if (!last) return null;
  let count = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i]?.toUpperCase() === last) count++;
    else break;
  }
  return `${last}${count}`;
}

export function StandingsTable({ rows, className }: Props) {
  const [sortCol, setSortCol] = useState<string>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "team" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const getVal = (row: StandingRow, col: string): number | string => {
      switch (col) {
        case "rank": return row.rank;
        case "team": return row.team;
        case "played": return row.played;
        case "wins": return row.wins;
        case "draws": return row.draws;
        case "losses": return row.losses;
        case "goalsFor": return row.goalsFor;
        case "goalsAgainst": return row.goalsAgainst;
        case "goalDiff": return row.goalDiff;
        case "points": return row.points;
        case "xG": return row.xG ?? 0;
        case "xGA": return row.xGA ?? 0;
        default: return 0;
      }
    };
    return [...rows].sort((a, b) => {
      const va = getVal(a, sortCol);
      const vb = getVal(b, sortCol);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div className={cn("relative overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent", className)}>
      {/* Gradient fade droite mobile */}
      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-zinc-950 to-transparent sm:hidden" />
      <table className="w-full text-sm min-w-[800px]">
        <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm">
          <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
            {[
              { key: "#", label: "#", w: "w-8" },
              { key: "team", label: "Team", w: "" },
              { key: "played", label: "P", w: "" },
              { key: "wins", label: "W", w: "" },
              { key: "draws", label: "D", w: "" },
              { key: "losses", label: "L", w: "" },
              { key: "goalsFor", label: "GF", w: "" },
              { key: "goalsAgainst", label: "GA", w: "" },
              { key: "goalDiff", label: "+/-", w: "" },
              { key: "points", label: "Pts", w: "" },
              { key: "xG", label: "xG", w: "" },
              { key: "xGA", label: "xGA", w: "" },
            ].map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-2 py-2 text-center cursor-pointer select-none hover:text-white transition-colors",
                  col.w,
                  sortCol === col.key && "text-[#00985f]",
                )}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-0.5">
                  {col.label}
                  {sortCol === col.key && (
                    <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
            ))}
            <th className="px-2 py-2 text-center">Form</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.team}
              className={cn(
                "border-b border-zinc-800/50 transition-colors hover:bg-[#00985f]/5",
                i % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]",
              )}
            >
              <td className="px-2 py-2 text-center text-zinc-400">{row.rank}</td>
              <td className="px-2 py-2 text-left font-medium text-white">
                <div className="flex items-center gap-2">
                  {row.logo && (
                    <img src={row.logo} alt="" className="h-4 w-4 rounded-full" loading="lazy" />
                  )}
                  <span className="truncate">{row.shortName ?? row.team}</span>
                </div>
              </td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.played}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.wins}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.draws}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.losses}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.goalsFor}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">{row.goalsAgainst}</td>
              <td className={cn(
                "px-2 py-2 text-center tabular-nums font-medium",
                row.goalDiff > 0 ? "text-[#00985f]" : row.goalDiff < 0 ? "text-[#DD3636]" : "text-zinc-300",
              )}>
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </td>
              <td className="px-2 py-2 text-center tabular-nums font-bold text-white">{row.points}</td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">
                {row.xG != null ? row.xG.toFixed(2) : "-"}
              </td>
              <td className="px-2 py-2 text-center tabular-nums text-zinc-300">
                {row.xGA != null ? row.xGA.toFixed(2) : "-"}
              </td>
              <td className="px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-0.5">
                  {row.form?.slice(-5).map((f, fi) => (
                    <FormBadge key={fi} result={f} />
                  ))}
                  {formStreak(row.form) && (
                    <span className="ml-1 text-[10px] font-medium text-zinc-500">
                      {formStreak(row.form)}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Re-export pour rétrocompatibilité avec les imports existants. */
export function LeagueStatsTable({ standings, className }: { standings: any[]; className?: string }) {
  // Aplatir le format TeamStanding (avec .stats imbriqué) vers StandingRow (plat)
  const rows: StandingRow[] = standings.map((s: any) => ({
    rank: s.rank ?? 0,
    team: s.team?.name ?? s.team ?? "",
    shortName: s.team?.shortName,
    logo: s.team?.logo,
    played: s.stats?.played ?? s.played ?? 0,
    wins: s.stats?.wins ?? s.wins ?? 0,
    draws: s.stats?.draws ?? s.draws ?? 0,
    losses: s.stats?.losses ?? s.losses ?? 0,
    goalsFor: s.stats?.goalsFor ?? s.goalsFor ?? 0,
    goalsAgainst: s.stats?.goalsAgainst ?? s.goalsAgainst ?? 0,
    goalDiff: s.stats?.goalDiff ?? s.goalDiff ?? 0,
    points: s.stats?.points ?? s.points ?? 0,
    xG: s.stats?.xG ?? s.xG,
    xGA: s.stats?.xGA ?? s.xGA,
    form: s.stats?.form ?? s.form,
    ppg: s.stats?.pointsPerGame ?? s.ppg,
  }));
  return <StandingsTable rows={rows} className={className} />;
}
