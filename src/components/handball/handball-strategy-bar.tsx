"use client";

import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";

const STRATEGIES: { key: HandballStrategyKey; label: string; emoji: string }[] = [
  { key: "bestTeam", label: "Équipe", emoji: "🏆" },
  { key: "bestTeam1x2", label: "1X2", emoji: "📊" },
  { key: "over55", label: "Over", emoji: "⬆️" },
  { key: "under62", label: "U62.5", emoji: "⬇️" },
  { key: "handicap", label: "HC", emoji: "🎯" },
  { key: "btts30", label: "BTTS", emoji: "⚡" },
  { key: "htLeader", label: "HT", emoji: "⏱️" },
  { key: "valueBet", label: "EV+", emoji: "💰" },
];

export function HandballStrategyBar({ active, onChange }: { active: HandballStrategyKey; onChange: (k: HandballStrategyKey) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {STRATEGIES.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs border transition-colors ${active === s.key ? "bg-foreground text-background" : "hover:bg-muted"}`}
        >
          {s.emoji} {s.label}
        </button>
      ))}
    </div>
  );
}
