"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

/**
 * PlayerStatsFilters — Filtres pour la page Joueurs :
 *   - Search (nom joueur)
 *   - Game Range (All, Last 5, Last 10, Home, Away)
 *   - Position (All, F, M, D, G)
 *   - Total / Per 90 toggle
 */

export type GameRange = "all" | "last5" | "last10" | "home" | "away";
export type Position = "all" | "F" | "M" | "D" | "G";
export type ScaleMode = "total" | "per90";

export const GAME_RANGES: { value: GameRange; label: string }[] = [
  { value: "all", label: "All Games" },
  { value: "last5", label: "Last 5" },
  { value: "last10", label: "Last 10" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];

export const POSITIONS: { value: Position; label: string }[] = [
  { value: "all", label: "All" },
  { value: "F", label: "F" },
  { value: "M", label: "M" },
  { value: "D", label: "D" },
  { value: "G", label: "G" },
];

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  gameRange: GameRange;
  onGameRangeChange: (v: GameRange) => void;
  position: Position;
  onPositionChange: (v: Position) => void;
  scale: ScaleMode;
  onScaleChange: (v: ScaleMode) => void;
  className?: string;
};

export function PlayerStatsFilters({
  search,
  onSearchChange,
  gameRange,
  onGameRangeChange,
  position,
  onPositionChange,
  scale,
  onScaleChange,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Search */}
      <div className="relative min-w-[180px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-8 pr-3 text-base sm:text-xs text-white placeholder:text-zinc-500 focus:border-[#00985f] focus:outline-none focus:ring-1 focus:ring-[#00985f]/50"
        />
      </div>

      {/* Game Range */}
      <div className="flex gap-1">
        {GAME_RANGES.map((gr) => (
          <button
            key={gr.value}
            type="button"
            onClick={() => onGameRangeChange(gr.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              gameRange === gr.value
                ? "bg-[#00985f] text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
            )}
          >
            {gr.label}
          </button>
        ))}
      </div>

      {/* Position */}
      <div className="flex gap-1">
        {POSITIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPositionChange(p.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              position === p.value
                ? "bg-[#00985f] text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Scale toggle */}
      <div className="flex overflow-hidden rounded-md border border-zinc-700">
        <button
          type="button"
          onClick={() => onScaleChange("total")}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium transition-colors",
            scale === "total" ? "bg-white text-black" : "bg-transparent text-zinc-400 hover:text-white",
          )}
        >
          Total
        </button>
        <button
          type="button"
          onClick={() => onScaleChange("per90")}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium transition-colors",
            scale === "per90" ? "bg-white text-black" : "bg-transparent text-zinc-400 hover:text-white",
          )}
        >
          Per 90
        </button>
      </div>
    </div>
  );
}
