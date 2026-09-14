"use client";

import { cn } from "@/lib/utils";

/**
 * LeagueTabNav — Navigation par onglets pour la page championnat :
 *   - Standing (Classement)
 *   - Player Stats (Stats Joueurs)
 *   - Trends (Tendances — placeholder)
 */

export type LeagueTab = "standing" | "players" | "trends";

export const LEAGUE_TABS: { id: LeagueTab; label: string }[] = [
  { id: "standing", label: "Standing" },
  { id: "players", label: "Player Stats" },
  { id: "trends", label: "Trends" },
];

type Props = {
  value: LeagueTab;
  onChange: (tab: LeagueTab) => void;
  className?: string;
};

export function LeagueTabNav({ value, onChange, className }: Props) {
  return (
    <nav
      className={cn(
        "flex border-b border-zinc-800",
        className,
      )}
      role="tablist"
      aria-label="Sections de la ligue"
    >
      {LEAGUE_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {tab.label}
            {/* Indicateur actif — barre verte en bas */}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00985f]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
