"use client";

import { useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";

/* Teintes FotMob clair */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  rowSep: "#f5f5f5",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  team: "#222222",
  time: "#717171",
  league: "#9e9e9e",
} as const;

export function HandballCalendar({ matches }: { matches: HandballMatch[] }) {
  const byDate = useMemo(() => {
    const map = new Map<string, HandballMatch[]>();
    for (const m of matches) {
      const d = new Date(m.kickoff);
      const date = d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  if (byDate.length === 0)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun match programmé
      </div>
    );

  return (
    <div className="space-y-4">
      {byDate.map(([date, dayMatches]) => (
        <div key={date}>
          <h3
            className="text-sm font-semibold mb-2 capitalize px-3 py-1.5 rounded-t"
            style={{ backgroundColor: C.headerBg, color: C.headerText }}
          >
            {date}
          </h3>
          <div
            className="rounded-b border overflow-hidden"
            style={{ borderColor: C.cardBorder, backgroundColor: C.card }}
          >
            {dayMatches.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[#f8f8f8]"
                style={{
                  borderBottom:
                    i < dayMatches.length - 1
                      ? `1px solid ${C.rowSep}`
                      : undefined,
                }}
              >
                <span
                  className="text-xs w-16 tabular-nums"
                  style={{ color: C.time }}
                >
                  {new Date(m.kickoff).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Paris",
                  })}
                </span>
                <span
                  className="flex-1 text-right font-medium truncate"
                  style={{ color: C.team }}
                >
                  {m.home.name}
                </span>
                <span className="mx-2 text-xs" style={{ color: C.time }}>
                  vs
                </span>
                <span
                  className="flex-1 font-medium truncate"
                  style={{ color: C.team }}
                >
                  {m.away.name}
                </span>
                <span
                  className="text-xs w-32 text-right truncate"
                  style={{ color: C.league }}
                >
                  🤾 {m.league.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
