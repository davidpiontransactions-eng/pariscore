"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useFibaPlayers } from "@/hooks/use-fiba-players";
import type { FibaPlayer } from "@/app/api/fiba/players/route";

type StatKey = "composite" | "ppg" | "rpg" | "apg" | "pir" | "mvp";

const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: "composite", label: "Score" },
  { key: "ppg", label: "PPG" },
  { key: "rpg", label: "RPG" },
  { key: "apg", label: "APG" },
  { key: "pir", label: "PIR" },
  { key: "mvp", label: "MVP" },
];

const POSITION_OPTIONS = [
  { key: "all", label: "Tous" },
  { key: "G", label: "G" },
  { key: "F", label: "F" },
  { key: "C", label: "C" },
];

type FibaLeaderboardProps = {
  onPlayerClick?: (player: FibaPlayer) => void;
  className?: string;
};

export function FibaLeaderboard({ onPlayerClick, className }: FibaLeaderboardProps) {
  const [stat, setStat] = useState<StatKey>("composite");
  const [position, setPosition] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);

  const { players, isLoading, totalPlayers } = useFibaPlayers({
    stat,
    position: position === "all" ? undefined : position,
    sort: sortAsc ? "asc" : "desc",
  });

  const displayPlayers = useMemo(() => players.slice(0, 50), [players]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-sm text-muted-foreground animate-pulse">
          Chargement des joueuses...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Stat selector */}
        <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-0.5">
          {STAT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStat(opt.key)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                stat === opt.key
                  ? "bg-primary/20 text-primary"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Position filter */}
        <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-0.5">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPosition(opt.key)}
              className={cn(
                "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                position === opt.key
                  ? "bg-primary/20 text-primary"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort direction */}
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 bg-white/[0.06] rounded-lg"
        >
          {sortAsc ? "↑ Croissant" : "↓ Décroissant"}
        </button>

        <span className="text-[9px] text-muted-foreground ml-auto">
          {totalPlayers} joueuses
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.03]">
              <th className="px-2 py-1.5 text-left font-bold text-muted-foreground">#</th>
              <th className="px-2 py-1.5 text-left font-bold text-muted-foreground">Joueuse</th>
              <th className="px-2 py-1.5 text-left font-bold text-muted-foreground">Équipe</th>
              <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">GP</th>
              <th className="px-2 py-1.5 text-right font-bold text-muted-foreground">PPG</th>
              <th className="px-2 py-1.5 text-right font-bold text-muted-foreground">RPG</th>
              <th className="px-2 py-1.5 text-right font-bold text-muted-foreground">APG</th>
              <th className="px-2 py-1.5 text-right font-bold text-muted-foreground">PIR</th>
              <th className="px-2 py-1.5 text-right font-bold text-primary">Score</th>
            </tr>
          </thead>
          <tbody>
            {displayPlayers.map((player, idx) => (
              <tr
                key={player.playerId}
                className={cn(
                  "border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer",
                  idx < 3 && "bg-primary/[0.03]",
                )}
                onClick={() => onPlayerClick?.(player)}
              >
                <td className="px-2 py-1.5 text-muted-foreground font-mono">
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5 font-semibold">
                  <div className="flex items-center gap-1.5">
                    {player.headshot ? (
                      <img
                        src={player.headshot}
                        alt={player.name}
                        className="h-5 w-5 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">
                        {player.name.charAt(0)}
                      </div>
                    )}
                    <span className="truncate max-w-[120px]">{player.name}</span>
                    {player.mvpRank <= 3 && (
                      <Badge variant="default" className="bg-amber-500/80 text-[7px] px-1 py-0">
                        MVP #{player.mvpRank}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `#${player.teamColor}` }}
                    />
                    <span className="text-muted-foreground">{player.teamAbbr}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center text-muted-foreground font-mono">
                  {player.gamesPlayed}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {player.ppg.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {player.rpg.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {player.apg.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {player.pir.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right font-bold font-mono tabular-nums text-primary">
                  {player.composite.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayPlayers.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Aucune joueuse trouvée. Les stats seront disponibles après le premier match.
        </div>
      )}
    </div>
  );
}
