"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeatmapDatum = {
  sport: string;
  tournament: string;
  valueBets: number;
  totalMatches: number;
  avgEdge: number;
};

type ValueHeatmapProps = {
  data: HeatmapDatum[];
  className?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORT_ORDER = [
  "Tennis",
  "Football",
  "MMA",
  "CS2",
  "NBA",
  "WNBA",
  "Cycling",
  "F1",
] as const;

const SPORT_EMOJI: Record<string, string> = {
  Tennis: "🎾",
  Football: "⚽",
  MMA: "🥊",
  CS2: "🎯",
  NBA: "🏀",
  WNBA: "🏀",
  Cycling: "🚴",
  F1: "🏎️",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive cell colour class from average edge. */
function cellColorClass(avgEdge: number, hasValueBets: boolean): string {
  if (!hasValueBets) return "bg-muted/10";
  if (avgEdge >= 10) return "bg-emerald-500/40";
  if (avgEdge >= 5) return "bg-amber-500/40";
  return "bg-red-500/20";
}

/** Format edge as a signed percentage string. */
function formatEdge(edge: number): string {
  const sign = edge > 0 ? "+" : "";
  return `${sign}${edge.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ValueHeatmap({ data, className }: ValueHeatmapProps) {
  // ---- Pivot data into a sport × tournament grid ---------------------------
  const { sports, tournaments, grid } = useMemo(() => {
    // Collect unique tournaments in order of first appearance
    const tournamentSet = new Map<string, number>();
    for (const d of data) {
      if (!tournamentSet.has(d.tournament)) {
        tournamentSet.set(d.tournament, tournamentSet.size);
      }
    }
    const tournamentList = Array.from(tournamentSet.keys());

    // Build ordered sports (only those present in data)
    const presentSports = SPORT_ORDER.filter((s) =>
      data.some((d) => d.sport === s)
    );

    // Build lookup grid: sport → tournament → datum
    const gridMap: Record<string, Record<string, HeatmapDatum | undefined>> =
      {};
    for (const s of presentSports) {
      gridMap[s] = {};
    }
    for (const d of data) {
      if (gridMap[d.sport]) {
        gridMap[d.sport][d.tournament] = d;
      }
    }

    return {
      sports: presentSports,
      tournaments: tournamentList,
      grid: gridMap,
    };
  }, [data]);

  // ---- Edge case: no data --------------------------------------------------
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-border p-12 text-sm text-muted-foreground",
          className
        )}
      >
        No value bet data available
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="grid gap-px rounded-lg border border-border bg-border"
        style={{
          gridTemplateColumns: `120px repeat(${tournaments.length}, minmax(64px, 1fr))`,
          gridTemplateRows: `repeat(${sports.length}, 48px)`,
        }}
        role="grid"
        aria-label="Value bets heatmap by sport and tournament"
      >
        {/* Header row — tournament column labels */}
        <div
          className="flex items-center justify-center bg-card px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          role="columnheader"
        >
          Sport
        </div>
        {tournaments.map((t) => (
          <div
            key={t}
            className="flex items-center justify-center bg-card px-1 text-center text-[10px] font-medium leading-tight text-muted-foreground"
            role="columnheader"
            title={t}
          >
            <span className="line-clamp-2">{t}</span>
          </div>
        ))}

        {/* Data rows */}
        {sports.map((sport) => (
          <>
            {/* Sport row label */}
            <div
              key={`label-${sport}`}
              className="flex items-center gap-1.5 bg-card px-2 text-xs font-medium text-foreground"
              role="rowheader"
            >
              <span aria-hidden="true">{SPORT_EMOJI[sport] ?? "📌"}</span>
              <span>{sport}</span>
            </div>

            {/* Cells for this sport */}
            {tournaments.map((tournament) => {
              const cell = grid[sport]?.[tournament];
              const hasValueBets = cell ? cell.valueBets > 0 : false;
              const edge = cell?.avgEdge ?? 0;

              return (
                <Tooltip key={`${sport}-${tournament}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex cursor-default items-center justify-center text-xs font-mono tabular-nums transition-colors",
                        cellColorClass(edge, hasValueBets)
                      )}
                      role="gridcell"
                      aria-label={
                        cell
                          ? `${sport} – ${tournament}: ${cell.valueBets} value bets, ${cell.totalMatches} matches, avg ${formatEdge(cell.avgEdge)}`
                          : `${sport} – ${tournament}: no data`
                      }
                      tabIndex={cell ? 0 : undefined}
                    >
                      {cell && cell.valueBets > 0 && (
                        <span className="select-none text-[11px] font-semibold text-foreground">
                          {formatEdge(cell.avgEdge)}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {cell ? (
                      <p>
                        <span className="font-semibold">
                          {SPORT_EMOJI[sport] ?? ""} {sport} – {tournament}
                        </span>
                        <br />
                        {cell.valueBets} value bet{cell.valueBets !== 1 ? "s" : ""}{" "}
                        / {cell.totalMatches} match
                        {cell.totalMatches !== 1 ? "es" : ""}{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            cell.avgEdge >= 10
                              ? "text-emerald-400"
                              : cell.avgEdge >= 5
                                ? "text-amber-400"
                                : "text-red-400"
                          )}
                        >
                          (avg {formatEdge(cell.avgEdge)})
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        {SPORT_EMOJI[sport] ?? ""} {sport} – {tournament}: no data
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

