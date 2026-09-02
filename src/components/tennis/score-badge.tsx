"use client";

import { cn } from "@/lib/utils";

type ScoreBadgeProps = {
  score: number;          // 0-10
  label: string;          // "TOP MATCH" | "FEATURED" | "INTERESTING" | "STANDARD"
  labelColor: string;     // CSS class (ex: "text-emerald-400")
  labelBg: string;        // CSS class (ex: "bg-emerald-500/20")
  size?: "sm" | "md" | "lg";
  showScore?: boolean;    // Afficher le nombre a cote du label
  className?: string;
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "px-1.5 py-0.5 text-[10px] gap-1",
  md: "px-2 py-0.5 text-[11px] gap-1.5",
  lg: "px-2.5 py-1 text-xs gap-2",
};

/**
 * Badge visuel pour le score d'un match (0-10).
 *
 * - TOP MATCH (8.5-10) : emerald + glow
 * - FEATURED (7.0-8.4) : amber
 * - INTERESTING (5.0-6.9) : sky
 * - STANDARD (0-4.9) : gray
 *
 * Le score est affiche a cote du label si showScore=true.
 */
export function ScoreBadge({
  score,
  label,
  labelColor,
  labelBg,
  size = "md",
  showScore = true,
  className,
}: ScoreBadgeProps) {
  const isTop = label === "TOP MATCH";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold leading-none uppercase tracking-wide",
        SIZE_CLASSES[size],
        labelBg,
        labelColor,
        isTop && "ring-1 ring-emerald-500/30",
        className,
      )}
    >
      {isTop && <span className="text-[10px]">&#9733;</span>}
      <span>{label}</span>
      {showScore && (
        <span className={cn("font-mono tabular-nums", size === "sm" ? "text-[9px]" : "text-[10px]")}>
          {score.toFixed(1)}
        </span>
      )}
    </span>
  );
}
