"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SnookerPlayer {
  id: string;
  name: string;
  nationality?: string;
  eloRating?: number;
}

interface SnookerMatch {
  id: string;
  playerA: SnookerPlayer;
  playerB: SnookerPlayer;
  tournament: string;
  round?: string;
  bestOf: number;
  scoreA: number;
  scoreB: number;
  status: "scheduled" | "live" | "finished";
  probA?: number;
  probB?: number;
  edge?: number;
  scheduledAt?: string;
}

function getCountryFlag(nationality?: string): string {
  const flags: Record<string, string> = {
    England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    China: "🇨🇳",
    "Hong Kong": "🇭🇰",
    Australia: "🇦🇺",
    Belgium: "🇧🇪",
    Iran: "🇮🇷",
    Thailand: "🇹🇭",
    Malta: "🇲🇹",
    "Northern Ireland": "🇬🇧",
    Ireland: "🇮🇪",
    Germany: "🇩🇪",
    Netherlands: "🇳🇱",
    Brazil: "🇧🇷",
    Canada: "🇨🇦",
    India: "🇮🇳",
    Pakistan: "🇵🇰",
  };
  return flags[nationality || ""] || "🎱";
}

function getStatusColor(status: string) {
  switch (status) {
    case "live":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "finished":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    default:
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
}

export function SnookerMatchCard({ match }: { match: SnookerMatch }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasEdge = match.edge && match.edge > 0.02;
  const leaderA = match.scoreA > match.scoreB;
  const leaderB = match.scoreB > match.scoreA;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        isLive && "border-red-500/40 shadow-lg shadow-red-500/10",
        hasEdge && "border-emerald-500/40 shadow-lg shadow-emerald-500/10"
      )}
    >
      <CardContent className="p-4">
        {/* Tournament & Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-500 truncate">
            {match.tournament} {match.round ? `· ${match.round}` : ""}
          </span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusColor(match.status))}>
            {isLive ? "🔴 LIVE" : isFinished ? "Terminé" : "À venir"}
          </Badge>
        </div>

        {/* Players & Score */}
        <div className="space-y-2">
          {/* Player A */}
          <div className={cn("flex items-center justify-between", leaderA && "font-semibold")}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getCountryFlag(match.playerA.nationality)}</span>
              <span className="text-sm truncate max-w-[140px]">{match.playerA.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.playerA.eloRating && (
                <span className="text-[10px] text-zinc-500 font-mono">{Math.round(match.playerA.eloRating)}</span>
              )}
              <span className={cn("text-lg font-mono w-6 text-center", leaderA && "text-emerald-400")}>
                {match.scoreA}
              </span>
            </div>
          </div>

          {/* Divider with best-of info */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <div className="flex-1 h-px bg-zinc-800" />
            <span>Bo{match.bestOf}</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Player B */}
          <div className={cn("flex items-center justify-between", leaderB && "font-semibold")}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getCountryFlag(match.playerB.nationality)}</span>
              <span className="text-sm truncate max-w-[140px]">{match.playerB.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.playerB.eloRating && (
                <span className="text-[10px] text-zinc-500 font-mono">{Math.round(match.playerB.eloRating)}</span>
              )}
              <span className={cn("text-lg font-mono w-6 text-center", leaderB && "text-emerald-400")}>
                {match.scoreB}
              </span>
            </div>
          </div>
        </div>

        {/* Probabilities & Edge */}
        {(match.probA != null || hasEdge) && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
            {match.probA != null && (
              <div className="flex gap-3 text-[10px]">
                <span className="text-zinc-500">
                  <span className="text-emerald-400 font-mono">{(match.probA * 100).toFixed(1)}%</span> / <span className="text-blue-400 font-mono">{((match.probB || 0) * 100).toFixed(1)}%</span>
                </span>
              </div>
            )}
            {hasEdge && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                +{((match.edge || 0) * 100).toFixed(1)}% edge
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
