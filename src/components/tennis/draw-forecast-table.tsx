"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Crown } from "lucide-react";
import { CountryFlag } from "./country-flag";
import { RoundBadge } from "./round-badge";
import type { DrawRound, ForecastRow } from "@/lib/types/tennis-draw";

type DrawForecastTableProps = {
  forecast: ForecastRow[];
  currentRound?: DrawRound;
  className?: string;
};

/** Rounds affichés (R16 → W = colonnes cumulatives). */
const COLUMN_ROUNDS: DrawRound[] = ["R16", "QF", "SF", "F", "W"];

/** Badge seed — blanc sur fond sombre. */
function SeedBadge({ seed }: { seed?: number }) {
  if (!seed) return null;
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-white/90 ring-1 ring-white/20">
      {seed}
    </span>
  );
}

/** Icône de rang — blanc/gris uniquement. */
function RankIcon({ rank }: { rank: number }) {
  if (rank === 0) return <Crown className="h-3.5 w-3.5 text-white" />;
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-[9px] font-mono text-white/40">
      {rank + 1}
    </span>
  );
}

/** Barre de progression — blanc sur fond sombre. */
function ProbBar({ prob }: { prob: number }) {
  if (prob <= 0) {
    return <span className="text-[10px] text-white/20">—</span>;
  }
  const width = Math.max(prob, 5);
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-4 w-16 overflow-hidden rounded-sm bg-white/5 sm:w-20">
        <div
          className="absolute inset-y-0 left-0 rounded-sm bg-white/80 transition-all duration-300"
          style={{ width: `${width}%` }}
        />
        <span className="relative z-10 flex h-full items-center pl-1 font-mono text-[10px] tabular-nums text-white">
          {prob.toFixed(1)}
        </span>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-white/50">%</span>
    </div>
  );
}

export function DrawForecastTable({
  forecast,
  currentRound,
  className,
}: DrawForecastTableProps) {
  const sorted = useMemo(
    () =>
      [...forecast].sort(
        (a, b) => (b.probabilities.W ?? 0) - (a.probabilities.W ?? 0),
      ),
    [forecast],
  );

  return (
    <div className={cn("overflow-x-auto", className)}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-white/60" />
          <span className="text-xs font-semibold text-white">
            Forecast — {sorted.length} joueurs
          </span>
        </div>
        <span className="text-[10px] text-white/30">
          Simulations Elo surface-specific
        </span>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0e17]">
            <th className="w-7 px-1 py-2" />
            <th className="min-w-[140px] px-1 py-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              Joueur
            </th>
            {COLUMN_ROUNDS.map((r) => (
              <th
                key={r}
                className={cn(
                  "px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider",
                  currentRound === r ? "text-white" : "text-white/40",
                )}
              >
                <RoundBadge round={r} isActive={currentRound === r} size="sm" />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((row, i) => {
            const isFav = i === 0 && (row.probabilities.W ?? 0) > 0;

            return (
              <tr
                key={row.id ?? `${row.name}-${i}`}
                className={cn(
                  "group border-b border-white/5 transition-colors hover:bg-white/[0.03]",
                  isFav && "bg-white/[0.04]",
                )}
              >
                {/* Rang */}
                <td className="px-1 py-2.5 text-center">
                  <RankIcon rank={i} />
                </td>

                {/* Joueur */}
                <td className="px-1 py-2.5">
                  <div className="flex items-center gap-2">
                    <SeedBadge seed={row.seed} />
                    <CountryFlag countryCode={row.country} size="sm" />
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "truncate text-[11px] font-medium leading-tight",
                          isFav ? "text-white font-semibold" : "text-white/80",
                        )}
                      >
                        {row.name}
                      </span>
                      {row.qualifier && (
                        <span className="text-[9px] text-white/30">
                          {row.qualifier}
                        </span>
                      )}
                    </div>
                    {isFav && (
                      <Crown className="ml-auto h-3.5 w-3.5 text-white/50" />
                    )}
                  </div>
                </td>

                {/* Colonnes de probabilités */}
                {COLUMN_ROUNDS.map((r) => {
                  const prob = (row.probabilities[r] ?? 0) * 100;
                  return (
                    <td key={r} className="px-1 py-2.5">
                      <ProbBar prob={prob} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-[10px] text-white/40">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/80" />
          ≥ 50%
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/40" />
          20-49%
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
          &lt; 10%
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Crown className="h-3 w-3 text-white/60" />
          Favori titre
        </div>
      </div>

      {/* Méthodologie */}
      <div className="mt-2 rounded-md bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-white/30">
        <span className="font-medium text-white/50">Méthodologie :</span>{" "}
        Probabilités calculées par simulation Monte Carlo (100k tirages) utilisant
        des ratings Elo surface-specific. Chaque round est cumulatif — la colonne QF
        représente la probabilité d&apos;atteindre les quarts <em>ou mieux</em>.
        Source : TennisAbstract (Jeff Sackmann).
      </div>
    </div>
  );
}
