"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { HandballMatch } from "@/lib/handball-data";

type Props = {
  match: HandballMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HandballMatchDetailDialog({ match, open, onOpenChange }: Props) {
  if (!match) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

  const isLive = match.status === "live" || match.status === "halftime";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🤾 {match.league.name}
          </DialogTitle>
          <DialogDescription>{formatDate(match.kickoff)}</DialogDescription>
        </DialogHeader>

        {/* Score / Équipes */}
        <div className="flex items-center justify-between py-4">
          <div className="text-center flex-1">
            <div className="text-lg font-bold">{match.home.name}</div>
            {match.score && (
              <div className="text-3xl font-bold mt-1">{match.score.home}</div>
            )}
          </div>
          <div className="text-center px-4">
            {isLive ? (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                {match.status === "halftime" ? "MT" : `${match.minute || 0}'`}
              </span>
            ) : match.score ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="text-sm text-muted-foreground">vs</span>
            )}
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold">{match.away.name}</div>
            {match.score && (
              <div className="text-3xl font-bold mt-1">{match.score.away}</div>
            )}
          </div>
        </div>

        {/* Mi-temps */}
        {match.score?.homeHalf != null && (
          <div className="text-center text-sm text-muted-foreground">
            Mi-temps : {match.score.homeHalf} - {match.score.awayHalf}
          </div>
        )}

        {/* Stats live */}
        {match.stats && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-semibold">Statistiques</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-right font-medium">
                {match.stats.home7m ?? 0}
              </div>
              <div className="text-center text-muted-foreground">7m</div>
              <div className="font-medium">{match.stats.away7m ?? 0}</div>

              <div className="text-right font-medium">
                {match.stats.homeSaves ?? 0}
              </div>
              <div className="text-center text-muted-foreground">Arrêts</div>
              <div className="font-medium">{match.stats.awaySaves ?? 0}</div>

              <div className="text-right font-medium">
                {match.stats.homeRedCards ?? 0}
              </div>
              <div className="text-center text-muted-foreground">2min</div>
              <div className="font-medium">{match.stats.awayRedCards ?? 0}</div>
            </div>
          </div>
        )}

        {/* Cotes */}
        {match.odds && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-semibold">Cotes 1X2</h4>
            <div className="flex gap-2">
              {match.odds.home != null && (
                <div className="flex-1 text-center rounded border p-2">
                  <div className="text-xs text-muted-foreground">1</div>
                  <div className="font-bold">{match.odds.home}</div>
                </div>
              )}
              {match.odds.draw != null && (
                <div className="flex-1 text-center rounded border p-2">
                  <div className="text-xs text-muted-foreground">X</div>
                  <div className="font-bold">{match.odds.draw}</div>
                </div>
              )}
              {match.odds.away != null && (
                <div className="flex-1 text-center rounded border p-2">
                  <div className="text-xs text-muted-foreground">2</div>
                  <div className="font-bold">{match.odds.away}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
