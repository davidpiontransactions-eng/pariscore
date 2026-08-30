"use client";

import { cn } from "@/lib/utils";
import type { DrawRound } from "@/lib/types/tennis-draw";
import { ROUND_LABELS } from "@/lib/types/tennis-draw";

type RoundBadgeProps = {
  round: DrawRound;
  isActive?: boolean;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-[11px]",
};

export function RoundBadge({
  round,
  isActive = false,
  size = "sm",
  className,
}: RoundBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono font-bold leading-none uppercase tracking-wide",
        SIZE_CLASSES[size],
        isActive
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {ROUND_LABELS[round] ?? round}
    </span>
  );
}
