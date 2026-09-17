"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";

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
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  if (leagues.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs border transition-colors ${
          !selected
            ? "bg-foreground text-background"
            : "hover:bg-muted"
        }`}
      >
        🌍 Tous ({matches.length})
      </button>
      {leagues.map(([name, count]) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`whitespace-nowrap px-3 py-1 rounded-full text-xs border transition-colors ${
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
