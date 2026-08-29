"use client";

import { cn } from "@/lib/utils";
import type { H2HMatch } from "@/lib/types/basketball-h2h";

type H2HMatchesTabProps = {
  matches: H2HMatch[];
  teamAId: string | null;
  teamBId: string | null;
  className?: string;
};

export function H2HMatchesTab({
  matches,
  teamAId,
  teamBId,
  className,
}: H2HMatchesTabProps) {
  if (matches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Aucun historique de confrontation disponible.
      </p>
    );
  }

  // Grouper par saison
  const grouped = matches.reduce<Record<string, H2HMatch[]>>((acc, m) => {
    const season = m.season ?? "Inconnu";
    if (!acc[season]) acc[season] = [];
    acc[season].push(m);
    return acc;
  }, {});

  const seasons = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className={cn("space-y-3", className)}>
      {seasons.map((season) => (
        <div key={season}>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
            Saison {season}
          </div>
          <div className="space-y-0.5">
            {grouped[season].map((match) => {
              const isHomeA = match.home.id === teamAId;
              const aWon = match.winnerId === teamAId;
              const bWon = match.winnerId === teamBId;

              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground font-mono text-[10px] w-20 shrink-0">
                    {match.date}
                  </span>
                  <span className="text-muted-foreground text-[10px] w-12 shrink-0 text-center">
                    {match.league}
                  </span>
                  <span className="flex-1 flex items-center justify-center gap-2 font-mono">
                    <span className={cn("truncate", aWon && "text-emerald-400 font-bold")}>
                      {match.home.abbr}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">
                      {match.homeScore} - {match.awayScore}
                    </span>
                    <span className={cn("truncate", bWon && "text-emerald-400 font-bold")}>
                      {match.away.abbr}
                    </span>
                  </span>
                  <span className="w-20 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
