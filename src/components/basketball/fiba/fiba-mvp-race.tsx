"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFibaPlayers } from "@/hooks/use-fiba-players";
import type { FibaPlayer } from "@/app/api/fiba/players/route";

type FibaMvpRaceProps = {
  onPlayerClick?: (player: FibaPlayer) => void;
  className?: string;
};

/**
 * Course au MVP — Top 10 avec barres de progression et edge.
 */
export function FibaMvpRace({ onPlayerClick, className }: FibaMvpRaceProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { mvpTop10, isLoading } = useFibaPlayers({ stat: "mvp" });

  const top10 = useMemo(() => mvpTop10.slice(0, 10), [mvpTop10]);
  const maxScore = useMemo(() => {
    if (top10.length === 0) return 100;
    return Math.max(...top10.map((p) => p.mvpScore));
  }, [top10]);

  const selectedData = useMemo(
    () => top10.find((p) => p.playerId === selectedPlayer) ?? null,
    [top10, selectedPlayer],
  );

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-sm text-muted-foreground animate-pulse">
          Chargement de la course MVP...
        </div>
      </div>
    );
  }

  if (top10.length === 0) {
    return (
      <div className={cn("text-center py-8 text-sm text-muted-foreground", className)}>
        La course au MVP sera disponible après les premiers matchs.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold">🏆 Course au MVP</h3>
        <span className="text-[9px] text-muted-foreground">
          Top 10 par MVP Score
        </span>
      </div>

      {/* MVP List */}
      <div className="space-y-1.5">
        {top10.map((player, idx) => {
          const pct = (player.mvpScore / maxScore) * 100;
          const isSelected = selectedPlayer === player.playerId;
          const medals = ["🥇", "🥈", "🥉"];

          return (
            <div
              key={player.playerId}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]",
              )}
              onClick={() => setSelectedPlayer(isSelected ? null : player.playerId)}
            >
              {/* Rank */}
              <span className="w-6 text-center text-sm">
                {idx < 3 ? medals[idx] : (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {idx + 1}
                  </span>
                )}
              </span>

              {/* Player */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {player.headshot ? (
                  <img
                    src={player.headshot}
                    alt={player.name}
                    className="h-6 w-6 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold">
                    {player.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">{player.name}</div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: `#${player.teamColor}` }}
                    />
                    {player.teamAbbr}
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="flex-1 max-w-[100px]">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: idx < 3 ? "#00e676" : idx < 6 ? "#64748b" : "#475569",
                    }}
                  />
                </div>
              </div>

              {/* Score */}
              <span className={cn(
                "text-[12px] font-black tabular-nums w-10 text-right",
                idx < 3 ? "text-primary" : "text-muted-foreground",
              )}>
                {player.mvpScore.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Selected player detail */}
      {selectedData && (
        <div className="mt-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-bold">{selectedData.name}</h4>
            <span className="text-[9px] text-muted-foreground">— Détail</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">PPG</span>
              <span className="ml-1 font-bold">{selectedData.ppg.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">RPG</span>
              <span className="ml-1 font-bold">{selectedData.rpg.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">APG</span>
              <span className="ml-1 font-bold">{selectedData.apg.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">PIR</span>
              <span className="ml-1 font-bold">{selectedData.pir.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Composite</span>
              <span className="ml-1 font-bold">{selectedData.composite.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">GP</span>
              <span className="ml-1 font-bold">{selectedData.gamesPlayed}</span>
            </div>
          </div>
          <button
            onClick={() => onPlayerClick?.(selectedData)}
            className="mt-2 text-[10px] text-primary hover:underline"
          >
            Voir fiche complète →
          </button>
        </div>
      )}
    </div>
  );
}
