"use client";

import { cn } from "@/lib/utils";

type PlayerCI = {
  shortName: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  color: string;
};

type ConfidenceIntervalProps = {
  playerA: PlayerCI;
  playerB: PlayerCI;
  confidenceLevel?: number;
  label?: string;
  icon?: React.ReactNode;
  interpretation?: string;
  className?: string;
  variant?: "v1" | "v2";
};

const TRACK_COLORS = {
  default: { fill: "border-emerald-500/60 bg-emerald-500/15", line: "bg-emerald-600" },
  secondary: { fill: "border-amber-500/60 bg-amber-500/15", line: "bg-amber-600" },
} as const;

function DualTrack({ player, colorKey }: { player: PlayerCI; colorKey: keyof typeof TRACK_COLORS }) {
  const c = TRACK_COLORS[colorKey];
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: player.color }}
      />
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className="font-semibold" style={{ color: player.color }}>
            {player.shortName}
          </span>
          <span className="font-mono font-bold text-foreground">{player.value}%</span>
        </div>
        <div className="relative mt-1 h-3">
          <div className="absolute inset-0 rounded-full bg-muted" />
          <div
            className={cn("absolute inset-y-0 rounded-full", c.fill)}
            style={{
              left: `${player.ciLow}%`,
              right: `${100 - player.ciHigh}%`,
            }}
          />
          <div
            className={cn("absolute top-0 z-10 h-full w-0.5", c.line)}
            style={{ left: `${player.value}%` }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground">
          IC [{player.ciLow}%, {player.ciHigh}%]
        </div>
      </div>
    </div>
  );
}

export function ConfidenceInterval({
  playerA,
  playerB,
  confidenceLevel = 95,
  label = `Intervalle de confiance (IC ${confidenceLevel}%)`,
  icon,
  interpretation,
  className,
  variant = "v1",
}: ConfidenceIntervalProps) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="mb-3 flex items-center gap-1.5 min-w-0">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="truncate text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
      </div>

      {variant === "v2" ? (
        <div className="space-y-3">
          <DualTrack player={playerA} colorKey="default" />
          <DualTrack player={playerB} colorKey="secondary" />
        </div>
      ) : (
        <>
          <div className="relative h-12">
            <div className="absolute inset-0 rounded-full bg-muted">
              <div
                className="absolute inset-y-1 rounded-full border-2 border-emerald-500/60 bg-emerald-500/15"
                style={{
                  left: `${playerA.ciLow}%`,
                  right: `${100 - playerA.ciHigh}%`,
                }}
              />
              <div
                className="absolute inset-y-1 rounded-full border-2 border-amber-500/60 bg-amber-500/15"
                style={{
                  left: `${playerB.ciLow}%`,
                  right: `${100 - playerB.ciHigh}%`,
                }}
              />
              <div
                className="absolute top-0 z-10 h-full w-0.5 bg-emerald-600"
                style={{ left: `${playerA.value}%` }}
              />
              <div
                className="absolute top-0 z-10 h-full w-0.5 bg-amber-600"
                style={{ left: `${playerB.value}%` }}
              />
            </div>
          </div>

          <div className="mt-1 flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-emerald-500/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
                <span className="font-semibold" style={{ color: playerA.color }}>
                  {playerA.shortName}
                </span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold leading-tight text-foreground">
                {playerA.value}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                IC [{playerA.ciLow}%, {playerA.ciHigh}%]
              </div>
            </div>
            <div className="rounded-md bg-amber-500/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600" />
                <span className="font-semibold" style={{ color: playerB.color }}>
                  {playerB.shortName}
                </span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold leading-tight text-foreground">
                {playerB.value}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                IC [{playerB.ciLow}%, {playerB.ciHigh}%]
              </div>
            </div>
          </div>
        </>
      )}

      {interpretation && (
        <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {interpretation}
        </div>
      )}
    </div>
  );
}