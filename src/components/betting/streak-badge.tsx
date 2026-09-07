"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StreakInfo {
  type: string; // "WIN" | "LOSS" | "UNBEATEN" | etc.
  count: number;
}

function streakEmoji(type: string): string {
  switch (type) {
    case "WIN": return "🔥";
    case "LOSS": return "❄️";
    case "UNBEATEN": return "🛡️";
    case "BTTS": return "⚽";
    case "OVER25": return "📈";
    case "CLEAN_SHEET": return "🧱";
    default: return "📊";
  }
}

function streakVariant(type: string, count: number): string {
  if (["WIN", "UNBEATEN", "SCORED"].includes(type) && count >= 3) {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }
  if (["LOSS", "CONCEDED"].includes(type) && count >= 3) {
    return "bg-red-500/15 text-red-400 border-red-500/30";
  }
  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

export function StreakBadge({ streak }: { streak: StreakInfo }) {
  if (!streak || streak.count < 2) return null;

  return (
    <Badge
      variant="outline"
      className={cn("text-[9px] px-1 py-0 gap-0.5", streakVariant(streak.type, streak.count))}
    >
      <span>{streakEmoji(streak.type)}</span>
      <span className="font-mono font-bold">×{streak.count}</span>
    </Badge>
  );
}
