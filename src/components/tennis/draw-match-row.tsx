"use client";

import { cn } from "@/lib/utils";
import { CountryFlag } from "./country-flag";
import type { DrawMatch, DrawMatchPlayer } from "@/lib/types/tennis-draw";

type DrawMatchRowProps = {
  match: DrawMatch;
  onClick?: () => void;
};

function PlayerLine({
  player,
  isWinner,
  score,
  isLive,
}: {
  player: DrawMatchPlayer;
  isWinner: boolean;
  score?: string;
  isLive: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-[11px]",
        isWinner && "font-bold text-foreground",
        !isWinner && "text-muted-foreground",
      )}
    >
      {/* Seed */}
      {player.seed && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/70 font-mono text-[9px] font-bold text-muted-foreground">
          {player.seed}
        </span>
      )}

      {/* Drapeau */}
      <CountryFlag countryCode={player.country} size="sm" />

      {/* Nom */}
      <span className="truncate flex-1">{player.name}</span>

      {/* Score ou status */}
      {score && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {score}
        </span>
      )}

      {/* Indicateur live */}
      {isLive && !score && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
    </div>
  );
}

export function DrawMatchRow({ match, onClick }: DrawMatchRowProps) {
  const isCompleted = match.status === "completed";
  const isLive = match.status === "live";
  const p1Winner = isCompleted && match.winner === 1;
  const p2Winner = isCompleted && match.winner === 2;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded border border-border/60 bg-card transition-colors hover:bg-muted/50",
        isLive && "border-red-500/30",
      )}
    >
      {/* Player 1 */}
      <div
        className={cn(
          "border-b border-border/40",
          p1Winner && "border-l-2 border-l-emerald-500",
        )}
      >
        <PlayerLine
          player={match.player1}
          isWinner={p1Winner}
          score={isCompleted ? match.score?.split(/\s+/)[0] : undefined}
          isLive={isLive}
        />
      </div>

      {/* Player 2 */}
      <div className={cn(p2Winner && "border-l-2 border-l-emerald-500")}>
        <PlayerLine
          player={match.player2}
          isWinner={p2Winner}
          score={isCompleted ? match.score?.split(/\s+/)[1] : undefined}
          isLive={isLive}
        />
      </div>

      {/* Status badge (en bas, si pas complété) */}
      {!isCompleted && (
        <div className="border-t border-border/40 px-2 py-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none",
              isLive
                ? "bg-red-500/20 text-red-400"
                : "bg-muted/50 text-muted-foreground",
            )}
          >
            {isLive ? "Live" : "À venir"}
          </span>
        </div>
      )}
    </button>
  );
}
