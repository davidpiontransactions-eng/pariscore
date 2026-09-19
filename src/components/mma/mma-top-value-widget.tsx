"use client";

import { TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import type { MmaFight } from "./mma-fight-card";

type Props = {
  fights: MmaFight[];
  className?: string;
};

type ValueEntry = {
  fight: MmaFight;
  side: "a" | "b";
  ev: number;
  odds: number;
  fighter: string;
  opponent: string;
  photo?: string;
};

function buildTopValue(fights: MmaFight[], limit = 5): ValueEntry[] {
  const entries: ValueEntry[] = [];
  for (const f of fights) {
    if (f.bet_a && f.ev_a_pct != null && f.ev_a_pct > 0) {
      entries.push({
        fight: f,
        side: "a",
        ev: f.ev_a_pct,
        odds: f.best_odds_a ?? 0,
        fighter: f.fighter_a,
        opponent: f.fighter_b,
        photo: f.photo_a,
      });
    }
    if (f.bet_b && f.ev_b_pct != null && f.ev_b_pct > 0) {
      entries.push({
        fight: f,
        side: "b",
        ev: f.ev_b_pct,
        odds: f.best_odds_b ?? 0,
        fighter: f.fighter_b,
        opponent: f.fighter_a,
        photo: f.photo_b,
      });
    }
  }
  return entries
    .sort((a, b) => b.ev - a.ev)
    .slice(0, limit);
}

export function MmaTopValueWidget({ fights, className }: Props) {
  const top = buildTopValue(fights);

  if (top.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-bold text-foreground">
          Top Value Bets
        </h3>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          {top.length}
        </span>
      </div>

      <div className="space-y-2">
        {top.map((entry, i) => (
          <div
            key={`${entry.fight.fighter_a}-${entry.fight.fighter_b}-${entry.side}`}
            className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            {/* Rank */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {i + 1}
            </span>

            {/* Avatar */}
            <PlayerAvatar
              name={entry.fighter}
              photoUrl={entry.photo}
              size="sm"
              sport="mma"
            />

            {/* Fighter info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {entry.fighter}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                vs {entry.opponent}
              </p>
            </div>

            {/* Odds + EV */}
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-foreground">
                {entry.odds.toFixed(2)}
              </p>
              <p className="flex items-center justify-end gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                +{entry.ev.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
