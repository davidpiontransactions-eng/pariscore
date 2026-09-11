"use client";

/**
 * HockeyTopPlayers — Top 10 buteurs, assists et points pour une ligue.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Target, Share2, Medal } from "lucide-react";

type PlayerStat = {
  rank: number;
  name: string;
  position: string;
  playerId: string | null;
  playerSlug: string | null;
  photoUrl: string | null;
  team: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
  ppg: number;
  pim: number;
  plusMinus: number;
};

type TopPlayersProps = {
  topScorers: PlayerStat[];
  topAssists: PlayerStat[];
  topPoints: PlayerStat[];
  leagueName: string;
};

type ViewMode = "scorers" | "assists" | "points";

const VIEW_CONFIG = {
  scorers: { label: "Buteurs", icon: Target, stat: "g" as const, color: "#ff6b6b" },
  assists: { label: "Assists", icon: Share2, stat: "a" as const, color: "#5fbfff" },
  points: { label: "Points", icon: Trophy, stat: "tp" as const, color: "#00e676" },
};

function PlayerRow({
  player,
  rank,
  statKey,
  color,
}: {
  player: PlayerStat;
  rank: number;
  statKey: "g" | "a" | "tp";
  color: string;
}) {
  const value = player[statKey];
  const maxStat = statKey === "g" ? 10 : statKey === "a" ? 10 : 15;
  const barWidth = Math.min((value / maxStat) * 100, 100);

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 hover:bg-white/5 transition-colors rounded-md">
      <span className={cn(
        "w-6 text-center text-xs font-bold",
        rank <= 3 ? "text-[#00e676]" : "text-white/40"
      )}>
        {rank}
      </span>
      {/* Photo joueur */}
      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-[10px] text-white/30">{player.name.charAt(0)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{player.name}</span>
          <span className="text-[10px] text-white/30 shrink-0">{player.position}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-white/40">{player.team}</span>
          <span className="text-[10px] text-white/30">GP:{player.gp}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-sm font-bold w-8 text-right" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

export function HockeyTopPlayers({
  topScorers,
  topAssists,
  topPoints,
  leagueName,
}: TopPlayersProps) {
  const [view, setView] = useState<ViewMode>("points");

  const config = VIEW_CONFIG[view];
  const players = view === "scorers" ? topScorers : view === "assists" ? topAssists : topPoints;

  const hasData = players.length > 0 && players[0].gp > 0;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        {(Object.entries(VIEW_CONFIG) as [ViewMode, typeof config][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                view === key
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {!hasData ? (
        <div className="text-center text-white/40 text-sm py-8">
          Aucune stats disponible — la saison {leagueName} n&apos;a pas encore commence
        </div>
      ) : (
        <div className="space-y-0.5">
          {players.slice(0, 10).map((p, i) => (
            <PlayerRow
              key={`${p.name}-${p.team}`}
              player={p}
              rank={i + 1}
              statKey={config.stat}
              color={config.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
