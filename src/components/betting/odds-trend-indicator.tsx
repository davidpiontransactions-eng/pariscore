"use client";

import { cn } from "@/lib/utils";

interface OddsTrend {
  opening: number;
  closing: number;
  movement: number; // opening - closing
  dropPct: number;
  direction: "SHORTENING" | "DRIFTING" | "STABLE";
}

export function OddsTrendIndicator({ trend }: { trend: OddsTrend }) {
  const isShortening = trend.direction === "SHORTENING";
  const isDrifting = trend.direction === "DRIFTING";

  return (
    <div className="flex items-center gap-1 text-[10px] font-mono">
      <span className="text-zinc-500">{trend.opening.toFixed(2)}</span>
      <span className="text-zinc-600">→</span>
      <span className={cn(
        isShortening && "text-emerald-400",
        isDrifting && "text-red-400",
        !isShortening && !isDrifting && "text-zinc-400"
      )}>
        {trend.closing.toFixed(2)}
      </span>
      {trend.direction !== "STABLE" && (
        <span className={cn(
          "px-1 py-0 rounded text-[8px] font-bold",
          isShortening && "bg-emerald-500/20 text-emerald-400",
          isDrifting && "bg-red-500/20 text-red-400"
        )}>
          {isShortening ? "▼" : "▲"} {trend.dropPct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
