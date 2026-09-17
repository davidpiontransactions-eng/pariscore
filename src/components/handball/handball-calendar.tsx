"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";

export function HandballCalendar({ matches }: { matches: HandballMatch[] }) {
  const byDate = useMemo(() => {
    const map = new Map<string, HandballMatch[]>();
    for (const m of matches) {
      const date = new Date(m.kickoff).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  if (byDate.length === 0) return <div className="text-center py-8 text-muted-foreground">Aucun match programmé</div>;

  return (
    <div className="space-y-4">
      {byDate.map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 capitalize">{date}</h3>
          <div className="space-y-1">
            {dayMatches.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted/50">
                <span className="text-xs text-muted-foreground w-16">{new Date(m.kickoff).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="flex-1 text-right">{m.home.name}</span>
                <span className="mx-2 text-xs text-muted-foreground">vs</span>
                <span className="flex-1">{m.away.name}</span>
                <span className="text-xs text-muted-foreground w-32 text-right">🤾 {m.league.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
