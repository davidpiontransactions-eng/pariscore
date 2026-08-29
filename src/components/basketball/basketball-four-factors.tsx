"use client";

import { cn } from "@/lib/utils";
import type { FourFactors } from "@/lib/basketball-data";

type BasketballFourFactorsProps = {
  fourFactors: FourFactors;
  homeAbbr: string;
  awayAbbr: string;
  className?: string;
};

type FactorRow = {
  label: string;
  home: number | null;
  away: number | null;
  higherBetter: boolean;
  format: "pct" | "dec" | "int";
};

export function BasketballFourFactors({ fourFactors, homeAbbr, awayAbbr, className }: BasketballFourFactorsProps) {
  const rows: FactorRow[] = [
    { label: "eFG%", home: fourFactors.efg_home, away: fourFactors.efg_away, higherBetter: true, format: "pct" },
    { label: "TOV%", home: fourFactors.tov_home, away: fourFactors.tov_away, higherBetter: false, format: "pct" },
    { label: "ORB%", home: fourFactors.orb_home, away: fourFactors.orb_away, higherBetter: true, format: "pct" },
    { label: "FT Rate", home: fourFactors.ft_home, away: fourFactors.ft_away, higherBetter: true, format: "pct" },
  ];

  const ratingRows: FactorRow[] = [
    { label: "ORtg", home: fourFactors.off_rating_home, away: fourFactors.off_rating_away, higherBetter: true, format: "dec" },
    { label: "DRtg", home: fourFactors.def_rating_home, away: fourFactors.def_rating_away, higherBetter: false, format: "dec" },
    { label: "NetRtg", home: fourFactors.net_rating_home, away: fourFactors.net_rating_away, higherBetter: true, format: "dec" },
    { label: "Pace", home: fourFactors.pace_home, away: fourFactors.pace_away, higherBetter: false, format: "dec" },
  ];

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Four Factors
        </h4>
        {!fourFactors.complete && (
          <span className="text-[10px] text-yellow-500">Partiel</span>
        )}
      </div>

      {/* Header */}
      <div className="mb-1 grid grid-cols-3 gap-1 text-[10px] font-medium text-muted-foreground">
        <div></div>
        <div className="text-center">{homeAbbr}</div>
        <div className="text-center">{awayAbbr}</div>
      </div>

      {/* Four Factors rows */}
      {rows.map((row) => (
        <FactorRow key={row.label} row={row} />
      ))}

      {/* Separator */}
      <div className="my-1.5 border-t" />

      {/* Ratings */}
      {ratingRows.map((row) => (
        <FactorRow key={row.label} row={row} />
      ))}
    </div>
  );
}

function FactorRow({ row }: { row: FactorRow }) {
  const homeWins = row.home != null && row.away != null
    ? row.higherBetter ? row.home > row.away : row.home < row.away
    : false;
  const awayWins = row.home != null && row.away != null
    ? row.higherBetter ? row.away > row.home : row.away < row.home
    : false;

  const formatValue = (v: number | null): string => {
    if (v == null) return "—";
    if (row.format === "pct") return `${v.toFixed(1)}%`;
    if (row.format === "int") return Math.round(v).toString();
    return v.toFixed(1);
  };

  return (
    <div className="grid grid-cols-3 gap-1 py-0.5 text-xs">
      <div className="text-[10px] text-muted-foreground">{row.label}</div>
      <div
        className={cn(
          "text-center tabular-nums",
          homeWins && "font-semibold text-emerald-500",
          awayWins && "text-muted-foreground",
        )}
      >
        {formatValue(row.home)}
      </div>
      <div
        className={cn(
          "text-center tabular-nums",
          awayWins && "font-semibold text-emerald-500",
          homeWins && "text-muted-foreground",
        )}
      >
        {formatValue(row.away)}
      </div>
    </div>
  );
}
