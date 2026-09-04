"use client";

import { cn } from "@/lib/utils";

type WinProbabilityBarProps = {
  pHome: number;
  pAway: number;
  homeColor?: string;
  awayColor?: string;
  homeAbbr: string;
  awayAbbr: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

/**
 * Barre de Win Probability horizontale — style ESPN broadcast.
 * Deux segments colorés代表ant la probabilité de victoire de chaque équipe.
 */
export function WinProbabilityBar({
  pHome,
  pAway,
  homeColor = "#2196f3",
  awayColor = "#f44336",
  homeAbbr,
  awayAbbr,
  className,
  size = "md",
}: WinProbabilityBarProps) {
  const total = pHome + pAway;
  const homePct = total > 0 ? (pHome / total) * 100 : 50;
  const awayPct = 100 - homePct;

  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" };
  const textSizes = { sm: "text-[9px]", md: "text-[10px]", lg: "text-xs" };

  return (
    <div className={cn("w-full", className)}>
      {/* Labels */}
      <div className={cn("flex justify-between mb-0.5 font-mono tabular-nums", textSizes[size])}>
        <span className="font-semibold" style={{ color: homeColor }}>
          {homeAbbr} {pHome.toFixed(1)}%
        </span>
        <span className="font-semibold" style={{ color: awayColor }}>
          {awayAbbr} {pAway.toFixed(1)}%
        </span>
      </div>
      {/* Bar */}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted/50", heights[size])}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${homePct}%`,
            background: `linear-gradient(90deg, ${homeColor}, ${homeColor}dd)`,
          }}
        />
      </div>
    </div>
  );
}
