"use client";

import { useHandballTop8 } from "@/hooks/use-handball-top8";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";

/* Teintes FotMob clair */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  rowSep: "#f5f5f5",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  team: "#222222",
  meta: "#717171",
  league: "#9e9e9e",
  accent: "#00985f",
  accentBg: "rgba(0,152,95,0.08)",
  rank: "#9e9e9e",
} as const;

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
  const { matchesFor, isLoading, isReady } = useHandballTop8();
  const entries = matchesFor(strategy);
  const meta = STRATEGY_META[strategy];

  if (isLoading)
    return (
      <div className="text-center py-4" style={{ color: C.meta }}>
        Chargement stratégies...
      </div>
    );
  if (!isReady || entries.length === 0)
    return (
      <div className="text-center py-4" style={{ color: C.meta }}>
        Aucune donnée stratégie
      </div>
    );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold" style={{ color: C.headerText }}>
        {meta.emoji} {meta.label}
        <span className="ml-2 text-xs font-normal" style={{ color: C.league }}>
          {meta.metric}
        </span>
      </h3>
      <div
        className="rounded border overflow-hidden"
        style={{ borderColor: C.cardBorder, backgroundColor: C.card }}
      >
        {entries.map((e, i) => (
          <div
            key={e.matchId}
            className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[#f8f8f8]"
            style={{
              borderBottom:
                i < entries.length - 1 ? `1px solid ${C.rowSep}` : undefined,
            }}
          >
            {/* Rang */}
            <span
              className="w-5 text-center font-bold tabular-nums"
              style={{ color: C.rank }}
            >
              {i + 1}
            </span>

            {/* Équipes */}
            <div className="flex-1 min-w-0">
              <span
                className={e.pick === "home" ? "font-bold" : "font-medium"}
                style={{ color: e.pick === "home" ? C.accent : C.team }}
              >
                {e.home.shortName ?? e.home.name}
              </span>
              <span className="mx-1" style={{ color: C.meta }}>
                vs
              </span>
              <span
                className={e.pick === "away" ? "font-bold" : "font-medium"}
                style={{ color: e.pick === "away" ? C.accent : C.team }}
              >
                {e.away.shortName ?? e.away.name}
              </span>
            </div>

            {/* Ligue */}
            <span className="text-right truncate w-28" style={{ color: C.league }}>
              {e.league}
            </span>

            {/* Form */}
            {e.formSummary && (
              <span className="w-12 text-center tabular-nums" style={{ color: C.meta }}>
                {e.formSummary.home}
              </span>
            )}

            {/* Métrique principale */}
            <span
              className="font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums"
              style={{ backgroundColor: C.accentBg, color: C.accent }}
            >
              {e.value.toFixed(1)}
              {meta.unit}
            </span>

            {/* Over pill */}
            {strategy === "over55" && e.bestLine != null && (
              <span
                className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
                style={{ backgroundColor: "rgba(0,152,95,0.12)", color: C.accent }}
              >
                O{e.bestLine} {e.probPct?.toFixed(0)}%
              </span>
            )}

            {/* Prob % */}
            {e.probPct != null && (
              <span className="tabular-nums" style={{ color: C.meta }}>
                {e.probPct.toFixed(0)}%
              </span>
            )}

            {/* EV+ */}
            {e.ev != null && e.ev > 0 && (
              <span className="font-mono tabular-nums" style={{ color: C.accent }}>
                +{e.ev.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
