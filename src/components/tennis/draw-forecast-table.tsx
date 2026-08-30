"use client";

import { cn } from "@/lib/utils";
import { CountryFlag } from "./country-flag";
import { RoundBadge } from "./round-badge";
import type { DrawRound, ForecastRow } from "@/lib/types/tennis-draw";
import { ROUND_ORDER } from "@/lib/types/tennis-draw";

type DrawForecastTableProps = {
  forecast: ForecastRow[];
  currentRound?: DrawRound;
  className?: string;
};

/** Colonnes de rounds affichées dans le tableau (R16 → W). */
const COLUMN_ROUNDS: DrawRound[] = ["R16", "QF", "SF", "F", "W"];

function BarFill({ pct }: { pct: number }) {
  if (pct <= 0) return null;
  return (
    <div className="relative flex h-full w-full items-center">
      <div
        className="absolute inset-y-0 left-0 rounded-sm bg-emerald-500/30"
        style={{ width: `${pct}%` }}
      />
      <span className="relative z-10 w-full pl-1 font-mono text-[10px] tabular-nums">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function probCellClass(prob: number): string {
  if (prob >= 50) return "bg-emerald-500/15 text-emerald-400";
  if (prob >= 20) return "bg-amber-500/10 text-amber-400";
  return "text-muted-foreground";
}

/** Seed badge (seed number inside a small circle). */
function SeedBadge({ seed }: { seed?: number }) {
  if (!seed) return null;
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/70 font-mono text-[9px] font-bold text-muted-foreground">
      {seed}
    </span>
  );
}

export function DrawForecastTable({
  forecast,
  currentRound,
  className,
}: DrawForecastTableProps) {
  // Trouver le favori (prob_win la plus haute)
  const maxProbWin = Math.max(
    ...forecast.map((r) => r.probabilities.W ?? 0),
  );

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        {/* En-tête sticky */}
        <thead>
          <tr className="sticky top-0 z-20 bg-card">
            <th className="w-8 px-1 py-1.5 text-[10px] font-medium text-muted-foreground" />
            <th className="whitespace-nowrap px-1 py-1.5 text-[10px] font-medium text-muted-foreground">
              Joueur
            </th>
            {COLUMN_ROUNDS.map((r) => (
              <th
                key={r}
                className="px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground"
              >
                <RoundBadge
                  round={r}
                  isActive={currentRound === r}
                  size="sm"
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {forecast.map((row, i) => {
            const isFav = (row.probabilities.W ?? 0) === maxProbWin && maxProbWin > 0;
            const isBye = row.name.toLowerCase().includes("bye");

            return (
              <tr
                key={row.id ?? `${row.name}-${i}`}
                className={cn(
                  "group border-t border-border/40 transition-colors hover:bg-muted/50",
                  isFav && "border-l-2 border-l-emerald-500",
                  isBye && "opacity-40",
                )}
              >
                {/* Position */}
                <td className="px-1 py-1 text-[10px] font-mono text-muted-foreground/60">
                  {i + 1}
                </td>

                {/* Joueur */}
                <td className="max-w-[180px] whitespace-nowrap px-1 py-1">
                  <div className="flex items-center gap-1.5">
                    <SeedBadge seed={row.seed} />
                    <CountryFlag countryCode={row.country} size="sm" />
                    <span className="truncate text-[11px] font-medium">
                      {isBye ? "BYE" : row.name}
                    </span>
                  </div>
                </td>

                {/* Colonnes de probabilités */}
                {COLUMN_ROUNDS.map((r) => {
                  const prob = row.probabilities[r] ?? 0;
                  return (
                    <td
                      key={r}
                      className={cn(
                        "w-20 px-1 py-1 text-center",
                        probCellClass(prob),
                      )}
                    >
                      <BarFill pct={prob} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Légende */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/30" />
          ≥ 50%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-amber-500/20" />
          ≥ 20%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border border-emerald-500" />
          Favori
        </span>
      </div>

      {/* Source */}
      <p className="mt-2 text-[10px] text-muted-foreground/60">
        Forecasts basés sur simulations Elo surface-specific. Source:
        TennisAbstract
      </p>
    </div>
  );
}
