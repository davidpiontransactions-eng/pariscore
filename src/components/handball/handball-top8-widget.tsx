"use client";

import { useHandballTop8 } from "@/hooks/use-handball-top8";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";

const STRATEGY_LABELS: Record<HandballStrategyKey, { label: string; emoji: string }> = {
  bestTeam: { label: "Meilleure équipe", emoji: "🏆" },
  bestTeam1x2: { label: "1X2 Favori", emoji: "📊" },
  over55: { label: "Over 55.5", emoji: "⬆️" },
  under62: { label: "Under 62.5", emoji: "⬇️" },
  handicap: { label: "Handicap -4.5", emoji: "🎯" },
  btts30: { label: "BTTS 30+", emoji: "⚡" },
  htLeader: { label: "Leader HT", emoji: "⏱️" },
  valueBet: { label: "Value Bet", emoji: "💰" },
};

export function HandballTop8Widget({ strategy }: { strategy: HandballStrategyKey }) {
  const { matchesFor, isLoading, isReady } = useHandballTop8();
  const entries = matchesFor(strategy);
  const meta = STRATEGY_LABELS[strategy];

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Chargement stratégies...</div>;
  if (!isReady || entries.length === 0) return <div className="text-center py-4 text-muted-foreground">Aucune donnée stratégie</div>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{meta.emoji} {meta.label}</h3>
      <div className="space-y-1">
        {entries.map((e, i) => (
          <div key={e.matchId} className="flex items-center gap-2 rounded border px-3 py-2 text-xs hover:bg-muted/50">
            <span className="w-5 text-center font-bold text-muted-foreground">{i + 1}</span>
            <div className="flex-1">
              <span className={e.pick === "home" ? "font-bold" : ""}>{e.home.name}</span>
              <span className="mx-1 text-muted-foreground">vs</span>
              <span className={e.pick === "away" ? "font-bold" : ""}>{e.away.name}</span>
            </div>
            <span className="text-muted-foreground">{e.league}</span>
            <span className="font-mono font-semibold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">{e.value.toFixed(1)}</span>
            {e.probPct != null && <span className="text-muted-foreground">{e.probPct.toFixed(0)}%</span>}
            {e.ev != null && e.ev > 0 && <span className="text-emerald-500 font-mono">+{e.ev.toFixed(2)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
