"use client";

import { useHandballTop8 } from "@/hooks/use-handball-top8";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";

// Couleurs via tokens dark (bg-card/border-border/text-*) — pas de hex en dur

const STRATEGY_META: Record<
  HandballStrategyKey,
  { label: string; emoji: string; metric: string; unit: string }
> = {
  bestTeam: { label: "Meilleure équipe", emoji: "🏆", metric: "PPG", unit: "" },
  bestTeam1x2: { label: "1X2 Favori", emoji: "📊", metric: "Prob", unit: "%" },
  over55: { label: "Over Total", emoji: "⬆️", metric: "Prob", unit: "%" },
  under62: { label: "Under 62.5", emoji: "⬇️", metric: "Prob", unit: "%" },
  handicap: { label: "Handicap -4.5", emoji: "🎯", metric: "Prob", unit: "%" },
  btts30: { label: "BTTS 30+", emoji: "⚡", metric: "Prob", unit: "%" },
  htLeader: { label: "Leader HT", emoji: "⏱️", metric: "Score", unit: "" },
  valueBet: { label: "Value Bet", emoji: "💰", metric: "Edge", unit: "%" },
};

export function HandballTop8Widget({
  strategy,
}: {
  strategy: HandballStrategyKey;
}) {
  // Filtre serveur ?strat= (payload = stratégie active seulement)
  const { matchesFor, isLoading, isReady } = useHandballTop8(strategy);
  const entries = matchesFor(strategy);
  const meta = STRATEGY_META[strategy];

  if (isLoading)
    return (
      // État async annoncé aux lecteurs d'écran
      <div className="text-center py-4 text-muted-foreground" aria-live="polite">
        Chargement stratégies…
      </div>
    );
  if (!isReady || entries.length === 0)
    return (
      <div className="text-center py-4 text-muted-foreground" aria-live="polite">
        Aucune donnée stratégie
      </div>
    );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {meta.emoji} {meta.label}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {meta.metric}
        </span>
      </h3>
      <div className="rounded border border-border bg-card overflow-hidden divide-y divide-border">
        {entries.map((e, i) => (
          <div
            key={e.matchId}
            className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted"
          >
            {/* Rang */}
            <span className="w-5 text-center font-bold tabular-nums text-muted-foreground">
              {i + 1}
            </span>

            {/* Équipes */}
            <div className="flex-1 min-w-0">
              <span
                className={
                  e.pick === "home"
                    ? "font-bold text-primary"
                    : "font-medium text-foreground"
                }
              >
                {e.home.shortName ?? e.home.name}
              </span>
              <span className="mx-1 text-muted-foreground">
                vs
              </span>
              <span
                className={
                  e.pick === "away"
                    ? "font-bold text-primary"
                    : "font-medium text-foreground"
                }
              >
                {e.away.shortName ?? e.away.name}
              </span>
            </div>

            {/* Ligue */}
            <span className="text-right truncate w-28 text-muted-foreground">
              {e.league}
            </span>

            {/* Form */}
            {e.formSummary && (
              <span className="w-12 text-center tabular-nums text-muted-foreground">
                {e.formSummary.home}
              </span>
            )}

            {/* Métrique principale */}
            <span className="font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums bg-primary/10 text-primary">
              {e.value.toFixed(1)}
              {meta.unit}
            </span>

            {/* Over pill */}
            {strategy === "over55" && e.bestLine != null && (
              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums bg-primary/10 text-primary">
                O{e.bestLine} {e.probPct?.toFixed(0)}%
              </span>
            )}

            {/* Prob % */}
            {e.probPct != null && (
              <span className="tabular-nums text-muted-foreground">
                {e.probPct.toFixed(0)}%
              </span>
            )}

            {/* EV+ */}
            {e.ev != null && e.ev > 0 && (
              <span className="font-mono tabular-nums text-primary">
                +{e.ev.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
