"use client";

import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";
import { pillClass } from "./handball-pill";

// Onglet stratégie du Top 10 — pilules Flashscore sans emoji (bandeau épuré,
// charte partagée avec les filtres du calendrier).
const STRATEGIES: { key: HandballStrategyKey; label: string }[] = [
  { key: "bestTeam", label: "Équipe" },
  { key: "bestTeam1x2", label: "1X2" },
  { key: "over55", label: "Over" },
  { key: "under62", label: "U62.5" },
  { key: "handicap", label: "HC" },
  { key: "btts30", label: "BTTS" },
  { key: "htLeader", label: "HT" },
  { key: "valueBet", label: "EV+" },
];

export function HandballStrategyBar({ active, onChange }: { active: HandballStrategyKey; onChange: (k: HandballStrategyKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STRATEGIES.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          aria-pressed={active === s.key}
          className={pillClass(active === s.key)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
