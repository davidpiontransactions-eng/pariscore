"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { cn } from "@/lib/utils";
import { probTotalFramesOver } from "@/lib/services/snooker-analytics";

interface SnookerPlayer {
  id: string;
  name: string;
  nationality?: string;
  eloRating?: number;
  photoUrl?: string;
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
  pWin?: number;
  edge?: number;
  scheduledAt?: string;
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
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all",
        "bg-zinc-900/40 backdrop-blur-sm",
        isLive
          ? "border-red-500/40 shadow-lg shadow-red-500/10"
          : "border-zinc-800/50 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5",
        hasEdge && "border-emerald-500/40 shadow-lg shadow-emerald-500/10"
      )}
    >
      {/* Glass shine effect */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative z-10 p-4">
        {/* Tournament & Status */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 truncate">
            {match.tournament} {match.round ? `· ${match.round}` : ""}
          </span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusColor(match.status))}>
            {isLive ? "🔴 LIVE" : isFinished ? "Terminé" : "À venir"}
          </Badge>
        </div>

        {/* Players vs Score layout */}
        <div className="flex items-center gap-3">
          {/* Player A */}
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <PlayerAvatar
              name={match.playerA.name}
              photoUrl={match.playerA.photoUrl}
              size="md"
              sport="snooker"
            />
            <div className="text-center min-w-0">
              <p className={cn("text-sm truncate max-w-[120px]", leaderA && "font-semibold text-emerald-400")}>
                {match.playerA.name}
              </p>
              {match.playerA.eloRating && (
                <p className="text-[10px] font-mono text-zinc-500">
                  Elo {Math.round(match.playerA.eloRating)}
                </p>
              )}
            </div>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-xl font-mono font-bold w-6 text-center", leaderA && "text-emerald-400")}>
                {match.scoreA}
              </span>
              <span className="text-xs font-bold text-zinc-600">:</span>
              <span className={cn("text-xl font-mono font-bold w-6 text-center", leaderB && "text-emerald-400")}>
                {match.scoreB}
              </span>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">Bo{match.bestOf}</span>
          </div>

          {/* Player B */}
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <PlayerAvatar
              name={match.playerB.name}
              photoUrl={match.playerB.photoUrl}
              size="md"
              sport="snooker"
            />
            <div className="text-center min-w-0">
              <p className={cn("text-sm truncate max-w-[120px]", leaderB && "font-semibold text-emerald-400")}>
                {match.playerB.name}
              </p>
              {match.playerB.eloRating && (
                <p className="text-[10px] font-mono text-zinc-500">
                  Elo {Math.round(match.playerB.eloRating)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Probabilities & Edge */}
        {(match.probA != null || hasEdge) && (
          <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
            {match.probA != null && (
              <div className="flex gap-2 text-[10px]">
                <span className="text-zinc-500">
                  <span className="text-emerald-400 font-mono font-semibold">{(match.probA * 100).toFixed(1)}%</span>
                  <span className="mx-1 text-zinc-700">/</span>
                  <span className="text-blue-400 font-mono font-semibold">{((match.probB || 0) * 100).toFixed(1)}%</span>
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

        {/* Total De Manches — modèle prédictif */}
        {match.pWin != null && match.status !== "finished" && (() => {
          const pFrame = 0.5 + (match.pWin! - 0.5) / 2.2;
          const lines: number[] = [];
          const min = Math.max(3.5, Math.ceil(match.bestOf / 2) - 1.5);
          const max = match.bestOf - 0.5;
          for (let l = min; l <= max; l += 1) lines.push(l);
          if (lines.length === 0) return null;
          return (
            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <span>🎯</span> Total De Manches
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Ligne</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Plus de</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Moins de</span>
                {lines.map((line) => {
                  const over = probTotalFramesOver(match.bestOf, pFrame, line);
                  const under = 1 - over;
                  return (
                    <Fragment key={line}>
                      <span className="font-mono text-[11px] text-zinc-300">{line}</span>
                      <span className={cn("text-center font-mono text-[11px] font-semibold", over >= 0.6 ? "text-emerald-400" : over <= 0.4 ? "text-red-400" : "text-zinc-400")}>
                        {Math.round(over * 100)} %
                      </span>
                      <span className={cn("text-center font-mono text-[11px] font-semibold", under >= 0.6 ? "text-emerald-400" : under <= 0.4 ? "text-red-400" : "text-zinc-400")}>
                        {Math.round(under * 100)} %
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
