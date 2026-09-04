"use client";

import { cn } from "@/lib/utils";
import { useFibaStandings } from "@/hooks/use-fiba-standings";
import { Skeleton } from "@/components/ui/skeleton";
import type { FibaGroup, FibaTeam } from "@/app/api/fiba/standings/route";

type FibaStandingsProps = {
  className?: string;
};

function TeamRow({ team, rank }: { team: FibaTeam; rank: number }) {
  const diff = team.pointsFor - team.pointsAgainst;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      <span className="w-5 text-center text-[11px] font-mono text-muted-foreground">{rank}</span>
      <img
        src={team.logo}
        alt={team.name}
        className="h-5 w-5 shrink-0 rounded-sm object-contain"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold">{team.abbr}</span>
        <span className="text-[10px] text-muted-foreground ml-1.5 truncate hidden sm:inline">{team.name}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
        <span className="w-8 text-center font-semibold">{team.wins}-{team.losses}</span>
        <span className="w-12 text-right text-muted-foreground">{team.pointsFor}</span>
        <span className="w-12 text-right text-muted-foreground">{team.pointsAgainst}</span>
        <span className={cn("w-10 text-right font-semibold", diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-muted-foreground")}>
          {diffStr}
        </span>
        <span className="w-8 text-right font-bold">{team.points}</span>
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: FibaGroup }) {
  // Trier par points décroissants, puis differential
  const sorted = [...group.teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffB = b.pointsFor - b.pointsAgainst;
    const diffA = a.pointsFor - a.pointsAgainst;
    return diffB - diffA;
  });

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Group header */}
      <div className="px-3 py-2 bg-muted/30 border-b">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {group.name}
        </h3>
      </div>
      {/* Column headers */}
      <div className="flex items-center gap-2 py-1 px-2 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold border-b">
        <span className="w-5" />
        <span className="w-5" />
        <span className="flex-1">Équipe</span>
        <div className="flex items-center gap-3">
          <span className="w-8 text-center">W-L</span>
          <span className="w-12 text-right">PF</span>
          <span className="w-12 text-right">PA</span>
          <span className="w-10 text-right">+/-</span>
          <span className="w-8 text-right">PTS</span>
        </div>
      </div>
      {/* Teams */}
      <div className="divide-y divide-muted/30">
        {sorted.map((team, i) => (
          <TeamRow key={team.id} team={team} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-3">
          <Skeleton className="h-4 w-16 mb-3" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex items-center gap-2 py-2">
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8 ml-auto" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function FibaStandings({ className }: FibaStandingsProps) {
  const { groups, isLoading, error } = useFibaStandings();

  if (isLoading) return <StandingsSkeleton />;
  if (error) {
    return (
      <div className="rounded-xl border bg-destructive/10 p-4 text-center text-sm text-destructive">
        Erreur chargement standings FIBA
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Aucun groupe disponible
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
