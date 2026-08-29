"use client";

import type { StandingRow } from "@/lib/types/basketball-h2h";

type H2HStandingsPanelProps = {
  standings: StandingRow[];
  teamAId: string | null;
  teamBId: string | null;
  className?: string;
};

export function H2HStandingsPanel({
  standings,
  teamAId,
  teamBId,
  className,
}: H2HStandingsPanelProps) {
  if (standings.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Classement
        </div>
        <p className="text-[10px] text-muted-foreground text-center py-3">
          Données de classement non disponibles.
        </p>
      </div>
    );
  }

  const maxWins = Math.max(...standings.map((r) => r.wins), 1);

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Classement
      </div>
      <div className="space-y-1">
        {standings.map((row) => {
          const isHighlighted = row.team.id === teamAId || row.team.id === teamBId;
          const winRate = row.wins + row.losses > 0
            ? Math.round((row.wins / (row.wins + row.losses)) * 100)
            : 0;

          return (
            <div
              key={row.team.id}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1 text-[10px] transition-colors",
                isHighlighted
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50",
              )}
            >
              <span className="w-4 text-center font-mono text-muted-foreground">
                {row.rank}
              </span>
              {row.team.logo && (
                <img src={row.team.logo} alt="" className="h-3.5 w-3.5 object-contain" />
              )}
              <span className={cn("flex-1 truncate font-medium", isHighlighted && "text-primary")}>
                {row.team.abbr}
              </span>
              <span className="font-mono text-muted-foreground w-10 text-right">
                {row.wins}-{row.losses}
              </span>
              <div className="w-16 flex items-center gap-1">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
                <span className="font-mono text-muted-foreground w-7 text-right">
                  {winRate}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
