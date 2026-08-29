"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { H2HPlayer } from "@/lib/types/basketball-h2h";

type H2HPlayersTabProps = {
  playersA: H2HPlayer[];
  playersB: H2HPlayer[];
  teamAAbr: string;
  teamBAbr: string;
  className?: string;
};

type SortKey = "ppg" | "threesMade" | "rebounds" | "assists" | "blocks" | "steals" | "fgPct";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive ? (
          currentDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : null}
      </span>
    </th>
  );
}

function PlayerRow({
  player,
  sortKey,
  sortDir,
}: {
  player: H2HPlayer;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  const val = player[sortKey];
  const display = val !== null ? (sortKey === "fgPct" ? `${(val * 100).toFixed(1)}%` : val.toFixed(1)) : "—";

  return (
    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      <td className="py-1 px-2">
        <div className="flex items-center gap-2">
          {player.photo && (
            <img src={player.photo} alt="" className="h-5 w-5 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-medium truncate max-w-[120px]">{player.name}</div>
            <div className="text-[9px] text-muted-foreground font-mono">{player.pos} · #{player.jersey}</div>
          </div>
        </div>
      </td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.gp ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px] text-emerald-400 font-bold">{display}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.threesMade?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.rebounds?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.assists?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.blocks?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{player.steals?.toFixed(1) ?? "—"}</td>
    </tr>
  );
}

function PlayerTable({
  players,
  abbr,
  sortKey,
  sortDir,
  onSort,
}: {
  players: H2HPlayer[];
  abbr: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const sorted = [...players].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <div className="overflow-x-auto">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
        {abbr}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1 px-2 text-left text-[10px] font-medium text-muted-foreground">Joueur</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">MJ</th>
            <SortHeader label="PPG" sortKey="ppg" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="3PM" sortKey="threesMade" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="REB" sortKey="rebounds" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="AST" sortKey="assists" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="BLK" sortKey="blocks" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="STL" sortKey="steals" currentSort={sortKey} currentDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <PlayerRow key={p.id} player={p} sortKey={sortKey} sortDir={sortDir} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function H2HPlayersTab({
  playersA,
  playersB,
  teamAAbr,
  teamBAbr,
  className,
}: H2HPlayersTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ppg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <PlayerTable players={playersA} abbr={teamAAbr} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <PlayerTable players={playersB} abbr={teamBAbr} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
    </div>
  );
}
