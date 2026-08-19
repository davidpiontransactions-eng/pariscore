"use client";

// Panneau des cotes live « vainqueur » (P1/P2) de la Live Match Card.
//
// Sérialise la résolution du hook useOnexLiveOdds en UI :
//   - 1xBet (emerald) quand la source 1xBet a répondu, BSD (neutre) sinon ;
//   - chaque joueur : cote décimale + direction flash (▲ vert / ▼ rouge) ;
//   - Kelly dynamique : % de mise fractional (cap 0.25) recalculé à chaque
//     tick de cote — valeur > 0 uniquement (EV positif).
// Le panneau se rend sous la forme d'un strip compact du style des chips
// existantes (pip-match-row), sans charger la grille entière.

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeKellyStake } from "@/lib/kelly";
import type { LiveResolvedOdds } from "@/hooks/use-onex-live-odds";

type Props = {
  live: LiveResolvedOdds | null;
  nameA: string;
  nameB: string;
  shortNameA: string;
  shortNameB: string;
  colorA?: string;
  colorB?: string;
  probA: number;
  probB: number;
  className?: string;
};

type OddChipProps = {
  label: string;
  odd: number | null;
  dir: "up" | "down" | null;
  prob: number;
  className?: string;
};

function OddChip({ label, odd, dir, prob, className }: OddChipProps) {
  const kelly = odd != null ? computeKellyStake(prob, odd) : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-2 py-1",
        dir && dir === "up" && "animate-pulse border-emerald-500/40",
        dir && dir === "down" && "animate-pulse border-rose-500/40",
        className,
      )}
      title={`${label} — cote ${odd ?? "—"}${kelly && kelly.pct > 0 ? ` · Kelly ${kelly.pct.toFixed(1)}%` : ""}`}
    >
      <span className="max-w-[64px] truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
        {odd != null ? odd.toFixed(2) : "—"}
      </span>
      {odd != null && dir === "up" && (
        <TrendingUp className="h-3 w-3 text-emerald-500" aria-hidden />
      )}
      {odd != null && dir === "down" && (
        <TrendingDown className="h-3 w-3 text-rose-500" aria-hidden />
      )}
      {kelly && kelly.pct > 0 && (
        <span className="rounded bg-emerald-500/10 px-1 text-[9px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          K {kelly.pct.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

export function LiveOddsPanel({
  live,
  nameA,
  nameB,
  shortNameA,
  shortNameB,
  probA,
  probB,
  className,
}: Props) {
  if (!live || (live.oddA == null && live.oddB == null)) return null;

  const isOnex = live.source === "onex";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-2",
        className,
      )}
      role="group"
      aria-label="Cotes live (P1/P2)"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
          isOnex
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted/40 text-muted-foreground",
        )}
      >
        {isOnex ? "1xBet" : "BSD"}
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        LIVE
      </span>

      <OddChip
        label={shortNameA || nameA}
        odd={live.oddA}
        dir={live.dirA}
        prob={probA}
      />
      <OddChip
        label={shortNameB || nameB}
        odd={live.oddB}
        dir={live.dirB}
        prob={probB}
      />
    </div>
  );
}