"use client";

import { cn } from "@/lib/utils";

/**
 * StatCategoryPills — 14 boutons pills pour sélectionner la catégorie de stats.
 * Scroll horizontal avec gradient fade, snap scroll, style FotMob.
 *
 * Catégories : Overview, Betting Trends, Goals, Corners, Cards,
 * Possession, Passes, Tackles, Shots, Duels, Defensive, Attacking,
 * Goalkeeper, Set Pieces.
 */

export type StatCategory =
  | "overview"
  | "betting"
  | "goals"
  | "corners"
  | "cards"
  | "possession"
  | "passes"
  | "tackles"
  | "shots"
  | "duels"
  | "defensive"
  | "attacking"
  | "goalkeeper"
  | "set_pieces";

export const STAT_CATEGORIES: { id: StatCategory; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "betting", label: "Betting Trends" },
  { id: "goals", label: "Goals" },
  { id: "corners", label: "Corners" },
  { id: "cards", label: "Cards" },
  { id: "possession", label: "Possession" },
  { id: "passes", label: "Passes" },
  { id: "tackles", label: "Tackles" },
  { id: "shots", label: "Shots" },
  { id: "duels", label: "Duels" },
  { id: "defensive", label: "Defensive" },
  { id: "attacking", label: "Attacking" },
  { id: "goalkeeper", label: "Goalkeeper" },
  { id: "set_pieces", label: "Set Pieces" },
];

/** Colonnes associées à chaque catégorie (pour DynamicColumns). */
export const CATEGORY_COLUMNS: Record<StatCategory, string[]> = {
  overview: ["#", "Team", "P", "W", "D", "L", "GF", "GA", "+/-", "Pts", "Form"],
  betting: ["#", "Team", "P", "xG", "xGA", "PPG", "Over1.5", "BTTS"],
  goals: ["#", "Team", "GF", "GA", "GD", "GF/G", "GA/G", "Clean Sheet"],
  corners: ["#", "Team", "Corners For", "Corners Against", "C/G", "Over 7.5", "Over 8.5"],
  cards: ["#", "Team", "Yellow", "Red", "Cards/G", "Pen For", "Pen Against"],
  possession: ["#", "Team", "Possession%", "Poss Home", "Poss Away", "Prog Passes"],
  passes: ["#", "Team", "Passes", "Acc%", "Short%", "Medium%", "Long%", "Key Passes"],
  tackles: ["#", "Team", "Tackles", "Interceptions", "Blocks", "Clearances", "Recoveries"],
  shots: ["#", "Team", "Shots", "Shots On", "SoT%", "xG", "xG/Sh"],
  duels: ["#", "Team", "Aerial Won%", "Ground Duels", "Succ Dribbles", "Fouls Won"],
  defensive: ["#", "Team", "PPDA", "High Turnovers", "Deep Completions", "Opp G/Shot"],
  attacking: ["#", "Team", "Deep Completions", "Progressive Carries", "Final 3rd Passes", "Shots"],
  goalkeeper: ["#", "Team", "Save%", "PSxG-G", "Crosses Stopped", "Launch %"],
  set_pieces: ["#", "Team", "Corners/Match", "FK/Face", "Pen Scored%", "OG"],
};

type Props = {
  value: StatCategory;
  onChange: (cat: StatCategory) => void;
  className?: string;
};

export function StatCategoryPills({ value, onChange, className }: Props) {
  return (
    <div className={cn("relative", className)}>
      {/* Gradient fade gauche */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-background to-transparent" />
      {/* Gradient fade droite */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-background to-transparent" />

      <nav
        className="flex gap-1.5 overflow-x-auto px-2 py-1 scrollbar-none"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        role="tablist"
        aria-label="Catégories de stats"
      >
        {STAT_CATEGORIES.map((cat) => {
          const active = value === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                "scroll-snap-align-start whitespace-nowrap",
                active
                  ? "bg-[#00985f] text-white shadow-sm"
                  : "border border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500 hover:text-white",
              )}
              style={{ scrollSnapAlign: "start" }}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
