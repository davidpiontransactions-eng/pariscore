"use client";

import { useState, useMemo } from "react";
import type { TeamStanding } from "@/lib/league-stats";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof TeamStanding["stats"] | "rank" | "team";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "rank", label: "#", className: "w-10 text-center" },
  { key: "team", label: "Équipe" },
  { key: "played", label: "J", className: "text-center" },
  { key: "points", label: "Pts", className: "text-center" },
  { key: "pointsPerGame", label: "PPG", className: "text-center" },
  { key: "xG", label: "xG", className: "text-center" },
  { key: "xGA", label: "xGA", className: "text-center" },
  { key: "xGD", label: "xGD", className: "text-center" },
  { key: "over15Pct", label: "Over 1.5%", className: "text-center" },
  { key: "under35Pct", label: "Under 3.5%", className: "text-center" },
  { key: "bttsYesPct", label: "BTTS%", className: "text-center" },
];

export function LeagueStatsTable({
  standings,
}: {
  standings: TeamStanding[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    return [...standings].sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortKey === "rank") { va = a.rank; vb = b.rank; }
      else if (sortKey === "team") { va = a.team.name; vb = b.team.name; }
      else { va = a.stats[sortKey] as number; vb = b.stats[sortKey] as number; }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [standings, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (colKey !== sortKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortDir === "desc" ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUp className="ml-1 h-3 w-3" />;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-9 px-3 text-xs font-semibold whitespace-nowrap",
                  col.className,
                  col.key !== "rank" && col.key !== "team" && "cursor-pointer select-none hover:text-foreground",
                )}
                onClick={() => col.key !== "rank" && col.key !== "team" && handleSort(col.key)}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.key !== "rank" && col.key !== "team" && <SortIcon colKey={col.key} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s, i) => (
            <TableRow
              key={s.team.id}
              className={cn(
                "h-10 text-xs border-b border-border/50 hover:bg-muted/20 transition-colors",
                i < 3 && "bg-emerald-500/5",
                i >= sorted.length - 3 && "bg-rose-500/5",
              )}
            >
              <TableCell className="px-3 text-center font-mono text-muted-foreground">
                {s.rank}
              </TableCell>
              <TableCell className="px-3 font-medium whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.team.color || "#888" }}
                  />
                  {s.team.shortName}
                </span>
              </TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.played}</TableCell>
              <TableCell className="px-3 text-center font-semibold tabular-nums">{s.stats.points}</TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.pointsPerGame.toFixed(1)}</TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.xG.toFixed(1)}</TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.xGA.toFixed(1)}</TableCell>
              <TableCell className={cn("px-3 text-center tabular-nums", s.stats.xGD >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {s.stats.xGD >= 0 ? "+" : ""}{s.stats.xGD.toFixed(1)}
              </TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.over15Pct}%</TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.under35Pct}%</TableCell>
              <TableCell className="px-3 text-center tabular-nums">{s.stats.bttsYesPct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
