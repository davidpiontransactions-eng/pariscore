"use client";

import { cn } from "@/lib/utils";

type Props = {
  probA: number; // 0-100
  probB: number;
  ic?: [number, number]; // [low, high] for player A
  colorA: string;
  colorB: string;
  shortNameA: string;
  shortNameB: string;
  // Decomposition weights (0-1, will be normalized)
  weights?: { elo: number; form: number; h2h: number };
  showDecomposition?: boolean;
};

/**
 * Horizontal probability bar with:
 * - Stacked segments (A / B) colored per player
 * - IC 95% bracket overlay
 * - Optional decomposition ticks (Elo / Forme / H2H)
 */
export function ProbabilityBar({
  probA,
  probB,
  ic,
  colorA,
  colorB,
  shortNameA,
  shortNameB,
  weights,
  showDecomposition = false,
}: Props) {
  return (
    <div className="space-y-1.5">
      {/* Labels above */}
      <div className="flex justify-between text-[10px] font-semibold tabular-nums">
        <span style={{ color: colorA }}>
          {shortNameA} {probA}%
        </span>
        <span style={{ color: colorB }}>
          {probB}% {shortNameB}
        </span>
      </div>

      {/* Main bar */}
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        {/* Segment A */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700"
          style={{
            width: `${probA}%`,
            background: `linear-gradient(90deg, ${colorA}, ${colorA}dd)`,
          }}
        />
        {/* Segment B */}
        <div
          className="absolute inset-y-0 right-0 transition-all duration-700"
          style={{
            width: `${probB}%`,
            background: `linear-gradient(90deg, ${colorB}dd, ${colorB})`,
          }}
        />

        {/* IC 95% bracket */}
        {ic && ic[0] !== undefined && ic[1] !== undefined && (
          <>
            <div
              className="absolute inset-y-0 border-x-2 border-foreground/60"
              style={{
                left: `${ic[0]}%`,
                right: `${100 - ic[1]}%`,
              }}
            />
            {/* Median tick — Phase 4.D fix: bg-white was invisible in dark mode */}
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground"
              style={{ left: `${probA}%`, transform: "translateX(-50%)" }}
            />
          </>
        )}
      </div>

      {/* IC labels */}
      {ic && ic[0] !== undefined && ic[1] !== undefined && (
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
          <span>IC {ic[0]}%</span>
          <span className="text-muted-foreground/60">← 95% →</span>
          <span>{ic[1]}%</span>
        </div>
      )}

      {/* Decomposition */}
      {showDecomposition && weights && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full"
            style={{ width: `${weights.elo * 100}%`, background: colorA, opacity: 0.7 }}
            title={`Elo ${(weights.elo * 100).toFixed(0)}%`}
          />
          <div
            className="h-full"
            style={{ width: `${weights.form * 100}%`, background: colorA, opacity: 0.45 }}
            title={`Forme ${(weights.form * 100).toFixed(0)}%`}
          />
          <div
            className="h-full"
            style={{ width: `${weights.h2h * 100}%`, background: colorA, opacity: 0.25 }}
            title={`H2H ${(weights.h2h * 100).toFixed(0)}%`}
          />
        </div>
      )}
    </div>
  );
}
