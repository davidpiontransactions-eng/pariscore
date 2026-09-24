"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { sortHandballLeagueEntries } from "@/lib/handball-leagues";

export function HandballFilters({
  matches,
  selected,
  onSelect,
}: {
  matches: HandballMatch[];
  selected: string | null;
  onSelect: (l: string | null) => void;
}) {
  const leagues = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches)
      map.set(m.league.name, (map.get(m.league.name) || 0) + 1);
    // Tri 1xbet : ligues majeures en tête (tier), puis volume
    return sortHandballLeagueEntries(
      [...map.entries()].map(([name, count]) => ({ name, count })),
    );
  }, [matches]);

  if (leagues.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {/* Pills accessibles : état pressed + cible tactile 44px */}
      <button
        onClick={() => onSelect(null)}
        aria-pressed={!selected}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs border transition-colors min-h-[44px] ${
          !selected
            ? "bg-foreground text-background"
            : "hover:bg-muted"
        }`}
      >
        🌍 Tous ({matches.length})
      </button>
      {leagues.map(({ name, count }) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          aria-pressed={selected === name}
          className={`whitespace-nowrap px-3 py-1 rounded-full text-xs border transition-colors min-h-[44px] ${
            selected === name
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
        >
          {name} ({count})
        </button>
      ))}
    </div>
  );
}
