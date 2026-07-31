"use client";

import { useState, useMemo } from "react";
import { eloImpliedProb } from "@/lib/prediction/engine";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Surface = "Dur" | "Terre battue" | "Gazon";

type Props = {
  playerAName: string;
  playerBName: string;
  baseEloA: number;
  baseEloB: number;
  baseSurface: string;
  baseProbA: number;
  className?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SURFACES: Surface[] = ["Dur", "Terre battue", "Gazon"];

const FATIGUE_OPTIONS = [
  { label: "Normal", mod: 0 },
  { label: "5 sets gagnant (-3%)", mod: -3 },
  { label: "5 sets perdant (-7%)", mod: -7 },
];

const CONDITION_OPTIONS = [
  { label: "100%", mod: 0 },
  { label: "Blessure légère (-3%)", mod: -3 },
  { label: "Blessure modérée (-7%)", mod: -7 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatchScenarioSimulator({
  playerAName,
  playerBName,
  baseEloA,
  baseEloB,
  baseSurface,
  baseProbA,
  className,
}: Props) {
  const [surface, setSurface] = useState<Surface>(
    (SURFACES.includes(baseSurface as Surface) ? baseSurface : "Dur") as Surface,
  );
  const [fatigueMod, setFatigueMod] = useState(0);
  const [injuryMod, setInjuryMod] = useState(0);

  // --- surface Elo modifier ---
  const surfaceEloMod = useMemo(() => {
    if (surface === baseSurface) return 0;
    if (surface === "Gazon") return 20;
    return -15;
  }, [surface, baseSurface]);

  // --- compute probability ---
  const probA = useMemo(() => {
    const prob = eloImpliedProb(
      baseEloA + surfaceEloMod + fatigueMod + injuryMod,
      baseEloB,
    );
    return Math.round(prob * 100);
  }, [baseEloA, baseEloB, surfaceEloMod, fatigueMod, injuryMod]);

  // --- edge vs baseline ---
  const edge = probA - baseProbA;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-4",
        className,
      )}
    >
      {/* Title */}
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        🎯 Simulateur de Scénario
      </h2>

      {/* Controls */}
      <div className="space-y-4">
        {/* Surface */}
        <div>
          <label
            htmlFor="surface-select"
            className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Surface
          </label>
          <select
            id="surface-select"
            value={surface}
            onChange={(e) => setSurface(e.target.value as Surface)}
            className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          >
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Fatigue */}
        <div>
          <label
            htmlFor="fatigue-select"
            className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Fatigue dernier match
          </label>
          <select
            id="fatigue-select"
            value={fatigueMod}
            onChange={(e) => setFatigueMod(Number(e.target.value))}
            className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          >
            {FATIGUE_OPTIONS.map((o) => (
              <option key={o.label} value={o.mod}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Condition Joueur B */}
        <div>
          <label
            htmlFor="condition-select"
            className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Condition {playerBName}
          </label>
          <select
            id="condition-select"
            value={injuryMod}
            onChange={(e) => setInjuryMod(Number(e.target.value))}
            className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          >
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.label} value={o.mod}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result display */}
      <div className="mt-5 rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {playerAName}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {playerBName}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-2xl font-extrabold leading-tight tracking-tight text-foreground">
            Probabilité {playerAName}: {probA}%
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {100 - probA}%
          </span>
        </div>
      </div>

      {/* Edge badge */}
      <div className="mt-3">
        {edge > 5 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
            💰 Value Bet détectée
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pas de value significative
          </span>
        )}
      </div>
    </div>
  );
}

