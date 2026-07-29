"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Loader2 } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import type { FootballMatchStats } from "@/lib/bsd-football-fetcher";
import { MomentumChart } from "./momentum-chart";

type StatsResponse = FootballMatchStats & { source?: string; updatedAt?: string };

type Props = {
  match: FootballMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FootballMatchDetailDialog({ match, open, onOpenChange }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "loading" est dérivé : true tant qu'on attend la première réponse pour le
  // match courant. Évite les setState synchrones en tête d'effect (règle
  // react-hooks/set-state-in-effect).
  const loading = open && match !== null && stats === null && error === null;

  // Fetch lazy uniquement à l'ouverture du dialog (ou changement de match).
  useEffect(() => {
    if (!open || !match) return;
    let cancelled = false;
    const matchId = match.id.replace(/^bsd-/, "");
    // Reset dans un microtask (callback) → conforme à set-state-in-effect.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setStats(null);
      setError(null);
    });

    fetch(`/api/football/matches/${matchId}/stats`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as StatsResponse;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, match]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span>{match?.league.logo}</span>
              <span className="truncate font-medium">{match?.league.name}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Détails et momentum du match {match?.home.name} vs {match?.away.name}
          </DialogDescription>
        </DialogHeader>

        {/* En-tête : logos + score + minute */}
        {match && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                {match.home.logo ? (
                  <img src={match.home.logo} alt={match.home.name} className="h-9 w-9 object-contain" />
                ) : (
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span className="text-center text-xs font-semibold leading-tight">{match.home.shortName}</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black tabular-nums">{match.live?.homeScore ?? 0}</span>
                <span className="text-xl text-muted-foreground">:</span>
                <span className="text-3xl font-black tabular-nums">{match.live?.awayScore ?? 0}</span>
              </div>
              {match.live && (
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-500">
                  {match.live.status === "HT" ? "MI-TEMPS" : `${match.live.minute}'`}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                {match.away.logo ? (
                  <img src={match.away.logo} alt={match.away.name} className="h-9 w-9 object-contain" />
                ) : (
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span className="text-center text-xs font-semibold leading-tight">{match.away.shortName}</span>
            </div>
          </div>
        )}

        {/* Corps : graphe momentum */}
        <div className="mt-2">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[110px] w-full rounded-lg" />
              <Skeleton className="h-3 w-full" />
            </div>
          )}

          {!loading && error && (
            <div className="flex h-[110px] flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 text-center text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Momentum indisponible ({error})
            </div>
          )}

          {!loading && !error && stats && (
            <MomentumChart
              momentum={stats.momentum}
              goals={stats.goals}
              homeName={match?.home.shortName ?? "Domicile"}
              awayName={match?.away.shortName ?? "Extérieur"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
