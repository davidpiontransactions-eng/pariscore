"use client";

import type { TopMatch } from "@/lib/top-matches/types";

export function HandballMultiSportCard({ match }: { match: TopMatch }) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2 text-xs">
      <span className={match.status === "live" ? "font-bold" : ""}>{match.home.name}</span>
      <span className="mx-2 text-muted-foreground">
        {match.status === "live" ? match.score : "vs"}
      </span>
      <span className={match.status === "live" ? "font-bold" : ""}>{match.away.name}</span>
    </div>
  );
}
