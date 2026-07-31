"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Demo data (cross-sport live API not yet available)
// ---------------------------------------------------------------------------

const DEMO_LIVE = [
  { sport: "tennis", match: "Sinner vs Alcaraz", score: "6-3, 4-6, 3-2*", time: "3e set" },
  { sport: "football", match: "PSG vs OM", score: "2-1", time: "67'" },
  { sport: "mma", match: "Jones vs Adesanya", score: "R2 3:45", time: "Co-main" },
] as const;

// ---------------------------------------------------------------------------
// Sport emoji map
// ---------------------------------------------------------------------------

const SPORT_EMOJI: Record<string, string> = {
  tennis: "🎾",
  football: "⚽",
  mma: "🥊",
  basketball: "🏀",
  rugby: "🏉",
  hockey: "🏒",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type LiveNowCrossSportProps = {
  className?: string;
};

// ---------------------------------------------------------------------------
// Pulsing live dot
// ---------------------------------------------------------------------------

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveNowCrossSport({ className }: LiveNowCrossSportProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <LiveDot />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          ⚡ EN DIRECT
        </h2>
      </div>

      {/* Horizontal scrollable carousel */}
      <div
        className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-1 snap-x snap-mandatory scrollbar-none"
        role="list"
        aria-label="Matchs en direct"
      >
        {DEMO_LIVE.map((item, i) => (
          <div
            key={i}
            role="listitem"
            className={cn(
              "flex shrink-0 snap-start flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 min-w-[200px]",
              "transition-colors hover:border-rose-500/30 hover:bg-card/80",
            )}
          >
            {/* Top row: sport emoji + LIVE badge */}
            <div className="flex items-center justify-between">
              <span className="text-lg" aria-hidden="true">
                {SPORT_EMOJI[item.sport] ?? "🏆"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                <LiveDot />
                LIVE
              </span>
            </div>

            {/* Match name */}
            <p className="text-sm font-semibold leading-tight text-foreground">
              {item.match}
            </p>

            {/* Score + time */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-black tabular-nums text-foreground">
                {item.score}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {item.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
