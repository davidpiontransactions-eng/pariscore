"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OverBlock, OverRow3 } from "@/lib/types/basketball-h2h";

type OverUnderTableProps = {
  /** Titre de la section (ex. "Team Points O/U", "Q1 Points O/U"). */
  title: string;
  /** Données : soit un bloc simple (avg + seuils), soit 3 colonnes (A/B/avg). */
  data: OverBlock | OverRow3[];
  /** Mode 3 colonnes (Match Over, BTTS). */
  threeColumns?: boolean;
  /** Label colonne 1 (défaut "OVER"). */
  col1Label?: string;
  /** Label colonne 2 (défaut "%"). */
  col2Label?: string;
  /** Seuil "money" à surligner en ambre. */
  moneyThreshold?: number;
  /** Tooltip optionnel sur le titre. */
  tooltip?: string;
  className?: string;
};

/** Trouve le seuil le plus proche de la moyenne. */
function findMoneyThreshold(avg: number | null, thresholds: { threshold: number }[]): number | null {
  if (avg === null || thresholds.length === 0) return null;
  return thresholds.reduce((closest, row) =>
    Math.abs(row.threshold - avg) < Math.abs(closest.threshold - avg) ? row : closest
  ).threshold;
}

function BarFill({ pct, isMoney }: { pct: number; isMoney: boolean }) {
  const colorClass = isMoney
    ? "bg-amber-500"
    : pct > 50
      ? "bg-emerald-500"
      : "bg-red-500/70";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[60px]">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-mono tabular-nums ${
          pct > 50 ? "text-emerald-400" : "text-red-400/80"
        } ${isMoney ? "text-amber-400 font-bold" : ""}`}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export function OverUnderTable({
  title,
  data,
  threeColumns = false,
  col1Label = "OVER",
  col2Label = "%",
  moneyThreshold,
  tooltip,
  className,
}: OverUnderTableProps) {
  const titleEl = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dashed border-muted-foreground/30">
          {title}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-[10px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    title
  );

  // Mode 3 colonnes (Match Over, BTTS)
  if (threeColumns && Array.isArray(data)) {
    const autoMoney = findMoneyThreshold(null, data);

    return (
      <TooltipProvider>
        <div className={cn("overflow-x-auto", className)}>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
            {titleEl}
          </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 px-2 text-left text-[10px] text-muted-foreground font-medium">Seuil</th>
              <th className="py-1 px-2 text-right text-[10px] text-primary font-medium">A</th>
              <th className="py-1 px-2 text-right text-[10px] text-muted-foreground font-medium">Avg</th>
              <th className="py-1 px-2 text-right text-[10px] text-muted-foreground font-medium">B</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isMoney = (moneyThreshold ?? autoMoney) === row.threshold;
              return (
                <tr
                  key={row.threshold}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/50 transition-colors",
                    isMoney && "bg-amber-500/5",
                  )}
                >
                  <td className={cn("py-1 px-2 font-mono text-[10px]", isMoney && "text-amber-400 font-bold")}>
                    {col1Label} {row.threshold}
                  </td>
                  <td className="py-1 px-2 text-right"><BarFill pct={row.a} isMoney={isMoney} /></td>
                  <td className="py-1 px-2 text-right"><BarFill pct={row.avg} isMoney={isMoney} /></td>
                  <td className="py-1 px-2 text-right"><BarFill pct={row.b} isMoney={isMoney} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </TooltipProvider>
    );
  }

  // Mode bloc simple (OverBlock avec avg + seuils)
  const block = data as OverBlock;
  const autoMoney = findMoneyThreshold(block.avg, block.thresholds);

  return (
    <TooltipProvider>
      <div className={cn("overflow-x-auto", className)}>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {titleEl}
          </span>
          {block.avg !== null && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Moy: <span className="font-bold text-foreground">{block.avg.toFixed(1)}</span>
            </span>
          )}
        </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1 px-2 text-left text-[10px] text-muted-foreground font-medium">Seuil</th>
            <th className="py-1 px-2 text-right text-[10px] text-muted-foreground font-medium">{col1Label}</th>
            <th className="py-1 px-2 text-right text-[10px] text-muted-foreground font-medium">{col2Label}</th>
          </tr>
        </thead>
        <tbody>
          {block.thresholds.map((row) => {
            const isMoney = (moneyThreshold ?? autoMoney) === row.threshold;
            return (
              <tr
                key={row.threshold}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/50 transition-colors",
                  isMoney && "bg-amber-500/5",
                )}
              >
                <td className={cn("py-1 px-2 font-mono text-[10px]", isMoney && "text-amber-400 font-bold")}>
                  Over {row.threshold}
                </td>
                <td className="py-1 px-2 text-right"><BarFill pct={row.pct} isMoney={isMoney} /></td>
                <td className="py-1 px-2 text-right">
                  <span className="text-[10px] font-mono text-muted-foreground">{row.pct.toFixed(1)}%</span>
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
