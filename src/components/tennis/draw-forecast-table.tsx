"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Crown, Medal } from "lucide-react";
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

/** Labels complets pour tooltips. */
const ROUND_LABELS: Record<DrawRound, string> = {
  R64: "1/32e de finale",
  R32: "1/16e de finale",
  R16: "1/8e de finale",
  QF: "Quart de finale",
  SF: "Demi-finale",
  F: "Finale",
  W: "Vainqueur",
};

/** Couleur de la barre selon la probabilité. */
function barColor(prob: number): string {
  if (prob >= 60) return "bg-emerald-500";
  if (prob >= 40) return "bg-emerald-400/70";
  if (prob >= 20) return "bg-amber-400/70";
  if (prob >= 10) return "bg-amber-500/50";
  return "bg-slate-500/40";
}

/** Couleur du texte selon la probabilité. */
function textColor(prob: number): string {
  if (prob >= 50) return "text-emerald-400 font-semibold";
  if (prob >= 20) return "text-amber-400";
  if (prob >= 10) return "text-muted-foreground";
  return "text-muted-foreground/60";
}

/** Badge seed avec couleur par seed. */
function SeedBadge({ seed }: { seed?: number }) {
  if (!seed) return null;
  const isTop4 = seed <= 4;
  const isTop8 = seed <= 8;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
        isTop4 && "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30",
        !isTop4 && isTop8 && "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20",
        !isTop8 && "bg-muted text-muted-foreground",
      )}
    >
      {seed}
    </span>
  );
}

/** Icône de rang pour le podium. */
function RankIcon({ rank }: { rank: number }) {
  if (rank === 0) return <Crown className="h-3.5 w-3.5 text-emerald-400" />;
  if (rank === 1) return <Medal className="h-3 w-3 text-amber-400" />;
  if (rank === 2) return <Medal className="h-3 w-3 text-slate-400" />;
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-[9px] font-mono text-muted-foreground/50">
      {rank + 1}
    </span>
  );
}

/** Barre de progression horizontale. */
function ProbBar({ prob, maxProb }: { prob: number; maxProb: number }) {
  if (prob <= 0) {
    return <span className="text-[10px] text-muted-foreground/30">—</span>;
  }
  const width = maxProb > 0 ? Math.max((prob / maxProb) * 100, 8) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-4 w-16 overflow-hidden rounded-sm bg-muted/30 sm:w-20">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-sm transition-all duration-300", barColor(prob))}
          style={{ width: `${width}%` }}
        />
        <span className={cn("relative z-10 flex h-full items-center pl-1 font-mono text-[10px] tabular-nums", textColor(prob))}>
          {prob.toFixed(1)}
        </span>
      </div>
      <span className={cn("font-mono text-[10px] tabular-nums", textColor(prob))}>%</span>
    </div>
  );
}

export function DrawForecastTable({
  forecast,
  currentRound,
  className,
}: DrawForecastTableProps) {
  // Tri par probabilité de victoire (décroissant)
  const sorted = useMemo(
    () =>
      [...forecast].sort(
        (a, b) => (b.probabilities.W ?? 0) - (a.probabilities.W ?? 0),
      ),
    [forecast],
  );

  // Prob max pour normaliser les barres
  const maxProbWin = useMemo(
    () => Math.max(...sorted.map((r) => r.probabilities.W ?? 0), 1),
    [sorted],
  );

  return (
    <div className={cn("overflow-x-auto", className)}>
      {/* Header du tableau */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-foreground">
            Forecast — {sorted.length} joueurs
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/60">
          Simulations Elo surface-specific
        </span>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="sticky top-0 z-20 border-b border-border/60 bg-card">
            <th className="w-7 px-1 py-2" />
            <th className="min-w-[140px] px-1 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Joueur
            </th>
            {COLUMN_ROUNDS.map((r) => (
              <th
                key={r}
                className={cn(
                  "px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider",
                  currentRound === r ? "text-emerald-400" : "text-muted-foreground",
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
            const isPodium = i < 3;
            const winProb = row.probabilities.W ?? 0;

            return (
              <tr
                key={row.id ?? `${row.name}-${i}`}
                className={cn(
                  "group border-b border-border/30 transition-colors hover:bg-muted/40",
                  isFav && "bg-emerald-500/5",
                )}
              >
                {/* Rang + icône */}
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
                          isFav && "text-emerald-400",
                          isPodium && !isFav && "text-foreground",
                          !isPodium && "text-foreground/80",
                        )}
                      >
                        {row.name}
                      </span>
                      {row.qualifier && (
                        <span className="text-[9px] text-muted-foreground/50">
                          {row.qualifier}
                        </span>
                      )}
                    </div>
                    {isFav && (
                      <Crown className="ml-auto h-3.5 w-3.5 text-emerald-400/70" />
                    )}
                  </div>
                </td>

                {/* Colonnes de probabilités */}
                {COLUMN_ROUNDS.map((r) => {
                  const prob = (row.probabilities[r] ?? 0) * 100;
                  return (
                    <td key={r} className="px-1 py-2.5">
                      <ProbBar prob={prob} maxProb={100} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/30 pt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          ≥ 50%
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70" />
          20-49%
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-500/40" />
          &lt; 10%
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Crown className="h-3 w-3 text-emerald-400" />
          Favori titre
        </div>
      </div>

      {/* Méthodologie */}
      <div className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/70">
        <span className="font-medium text-muted-foreground">Méthodologie :</span>{" "}
        Probabilités calculées par simulation Monte Carlo (100k tirages) utilisant
        des ratings Elo surface-specific. Chaque round est cumulatif — la colonne QF
        représente la probabilité d&apos;atteindre les quarts <em>ou mieux</em>.
        Source : TennisAbstract (Jeff Sackmann).
      </div>
    </div>
  );
}
