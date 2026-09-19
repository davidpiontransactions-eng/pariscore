"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  bestOddsA?: number | null;
  bestOddsB?: number | null;
  aiOddsA?: number | null;
  aiOddsB?: number | null;
  evA?: number | null;
  evB?: number | null;
  fighterA: string;
  fighterB: string;
};

export function MmaOddsDisplay({
  bestOddsA,
  bestOddsB,
  aiOddsA,
  aiOddsB,
  evA,
  evB,
  fighterA,
  fighterB,
}: Props) {
  if (bestOddsA == null && bestOddsB == null) return null;

  const formatOdds = (v: number | null | undefined) =>
    v != null ? v.toFixed(2) : "—";

  const formatEv = (v: number | null | undefined) => {
    if (v == null) return null;
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
  };

  const evColor = (v: number | null | undefined) => {
    if (v == null) return "text-muted-foreground";
    if (v > 3) return "text-emerald-600 dark:text-emerald-400";
    if (v > 0) return "text-emerald-500 dark:text-emerald-400";
    if (v < -3) return "text-red-500 dark:text-red-400";
    return "text-muted-foreground";
  };

  const renderEvIcon = (v: number | null | undefined) => {
    if (v == null) return <Minus className="h-3 w-3" />;
    if (v > 0) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  return (
    <div className="mt-3 rounded-xl bg-muted/20 px-3 py-2.5">
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
        {/* Best odds */}
        <div className="text-muted-foreground">Cotes</div>
        <div className="text-center font-bold tabular-nums text-foreground">
          {formatOdds(bestOddsA)}
        </div>
        <div className="text-center font-bold tabular-nums text-foreground">
          {formatOdds(bestOddsB)}
        </div>

        {/* AI odds */}
        {aiOddsA != null && aiOddsB != null && (
          <>
            <div className="text-muted-foreground">IA</div>
            <div className="text-center tabular-nums text-foreground">
              {formatOdds(aiOddsA)}
            </div>
            <div className="text-center tabular-nums text-foreground">
              {formatOdds(aiOddsB)}
            </div>
          </>
        )}

        {/* EV */}
        {(evA != null || evB != null) && (
          <>
            <div className="text-muted-foreground">EV</div>
            <div className={cn("flex items-center justify-center gap-0.5 tabular-nums font-semibold", evColor(evA))}>
              {renderEvIcon(evA)}
              {formatEv(evA) ?? "—"}
            </div>
            <div className={cn("flex items-center justify-center gap-0.5 tabular-nums font-semibold", evColor(evB))}>
              {renderEvIcon(evB)}
              {formatEv(evB) ?? "—"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
