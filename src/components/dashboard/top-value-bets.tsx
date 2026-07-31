"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Demo data (cross-sport API not yet available)
// ---------------------------------------------------------------------------

const DEMO_BETS = [
  {
    id: "1",
    sport: "tennis",
    match: "Nadal vs Djokovic",
    edge: 22,
    confidence: 5,
    bookmaker: "Bet365",
  },
  {
    id: "2",
    sport: "football",
    match: "PSG vs OM — BTTS OUI",
    edge: 18,
    confidence: 4,
    bookmaker: "Unibet",
  },
  {
    id: "3",
    sport: "mma",
    match: "Jones vs Adesanya",
    edge: 15,
    confidence: 4,
    bookmaker: "Winamax",
  },
  {
    id: "4",
    sport: "tennis",
    match: "Sinner vs Alcaraz",
    edge: 12,
    confidence: 5,
    bookmaker: "Bwin",
  },
] as const;

// ---------------------------------------------------------------------------
// Sport emoji lookup
// ---------------------------------------------------------------------------

const SPORT_EMOJI: Record<string, string> = {
  tennis: "🎾",
  football: "⚽",
  mma: "🥊",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TopValueBetsListProps = {
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopValueBetsList({ className }: TopValueBetsListProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Section title */}
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        🔥 TOP VALUE BETS
      </h3>

      {/* Bet cards */}
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {DEMO_BETS.map((bet) => (
          <div
            key={bet.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3",
              "hover:border-emerald-500/40 transition-colors"
            )}
          >
            {/* Sport emoji + match name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">
                  {SPORT_EMOJI[bet.sport] ?? "📌"}
                </span>
                <span className="text-sm font-medium truncate">
                  {bet.match}
                </span>
              </div>
            </div>

            {/* Edge badge */}
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{bet.edge}% edge
            </span>

            {/* Confidence stars */}
            <span
              className="text-xs tabular-nums"
              aria-label={`${bet.confidence} sur 5 étoiles de confiance`}
            >
              {"⭐".repeat(bet.confidence)}
            </span>

            {/* Bookmaker */}
            <span className="text-xs text-muted-foreground shrink-0">
              {bet.bookmaker}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
