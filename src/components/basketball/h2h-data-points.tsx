"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { H2HDataPoints } from "@/lib/types/basketball-h2h";

type H2HDataPointsProps = {
  dataPoints: H2HDataPoints;
  teamAAbr: string;
  teamBAbr: string;
  className?: string;
};

type Row = {
  label: string;
  a: number | null;
  b: number | null;
  higherIsBetter: boolean;
  format?: "int" | "pct" | "dec";
  tooltip?: string;
};

const TOOLTIPS: Record<string, string> = {
  "Victoires": "Nombre de victoires dans l'historique des confrontations directes",
  "PPG": "Points par match — moyenne des points marqués lors des confrontations H2H",
  "Point Spread": "Écart de points moyen (PPG équipe A − PPG équipe B)",
  "FG%": "Field Goal Percentage — pourcentage de tirs réussis sur les confrontations H2H",
  "3P%": "Three-Point Percentage — pourcentage de tirs à 3 points réussis",
  "Assists/Match": "Passes décisives par match lors des confrontations directes",
  "Rebounds/Match": "Rebonds par match lors des confrontations directes",
};

function fmt(val: number | null, format: string): string {
  if (val === null) return "—";
  if (format === "pct") return `${(val * 100).toFixed(1)}%`;
  if (format === "dec") return val.toFixed(1);
  return String(Math.round(val));
}

function highlight(a: number | null, b: number | null, higherIsBetter: boolean) {
  if (a === null || b === null) return { aHl: false, bHl: false };
  if (a === b) return { aHl: false, bHl: false };
  if (higherIsBetter) {
    return { aHl: a > b, bHl: b > a };
  }
  return { aHl: a < b, bHl: b < a };
}

export function H2HDataPoints({
  dataPoints,
  teamAAbr,
  teamBAbr,
  className,
}: H2HDataPointsProps) {
  const rows: Row[] = [
    { label: "Victoires", a: dataPoints.wins.a, b: dataPoints.wins.b, higherIsBetter: true, format: "int", tooltip: TOOLTIPS["Victoires"] },
    { label: "PPG", a: dataPoints.ppg.a, b: dataPoints.ppg.b, higherIsBetter: true, format: "dec", tooltip: TOOLTIPS["PPG"] },
    { label: "Point Spread", a: dataPoints.pointSpread.a, b: dataPoints.pointSpread.b, higherIsBetter: true, format: "dec", tooltip: TOOLTIPS["Point Spread"] },
    { label: "FG%", a: dataPoints.fgPct.a, b: dataPoints.fgPct.b, higherIsBetter: true, format: "pct", tooltip: TOOLTIPS["FG%"] },
    { label: "3P%", a: dataPoints.threePct.a, b: dataPoints.threePct.b, higherIsBetter: true, format: "pct", tooltip: TOOLTIPS["3P%"] },
    { label: "Assists/Match", a: dataPoints.assistsPerGame.a, b: dataPoints.assistsPerGame.b, higherIsBetter: true, format: "dec", tooltip: TOOLTIPS["Assists/Match"] },
    { label: "Rebounds/Match", a: dataPoints.reboundsPerGame.a, b: dataPoints.reboundsPerGame.b, higherIsBetter: true, format: "dec", tooltip: TOOLTIPS["Rebounds/Match"] },
  ];

  return (
    <TooltipProvider>
      <div className={cn("overflow-x-auto", className)}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Métrique
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-primary">
                {teamAAbr}
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {teamBAbr}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { aHl, bHl } = highlight(row.a, row.b, row.higherIsBetter);
              return (
                <tr
                  key={row.label}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <td className="py-1.5 px-3 font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dashed border-muted-foreground/30">
                          {row.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                        {row.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className={cn("py-1.5 px-3 text-right font-mono", aHl && "text-emerald-400 font-bold")}>
                    {fmt(row.a, row.format ?? "dec")}
                    {aHl && <span className="ml-1 text-[9px]">▲</span>}
                  </td>
                  <td className={cn("py-1.5 px-3 text-right font-mono", bHl && "text-emerald-400 font-bold")}>
                    {fmt(row.b, row.format ?? "dec")}
                    {bHl && <span className="ml-1 text-[9px]">▲</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
