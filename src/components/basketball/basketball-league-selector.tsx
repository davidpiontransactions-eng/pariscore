"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BasketballLeagueId } from "@/lib/basketball-data";
import {
  getLeagueConfig,
  getLeaguesByGroup,
  GROUP_ORDER,
  type LeagueGroup,
} from "@/lib/basketball-league-config";

type LeagueSelectorProps = {
  selected: BasketballLeagueId[];
  onChange: (leagues: BasketballLeagueId[]) => void;
  className?: string;
};

const GROUP_LABELS: Record<LeagueGroup, string> = {
  usa: "USA",
  euro: "Euro",
  domestic: "Domestique",
  world: "Mondial",
  americas: "Amériques",
  asia: "Asie-Pac",
};

export function LeagueSelector({ selected, onChange, className }: LeagueSelectorProps) {
  const toggleLeague = (league: BasketballLeagueId) => {
    if (selected.includes(league)) {
      onChange(selected.filter((l) => l !== league));
    } else {
      onChange([...selected, league]);
    }
  };

  const toggleGroup = (group: LeagueGroup) => {
    // Seules les ligues avec feed participent au toggle groupe (état explicite)
    const groupLeagues = getLeaguesByGroup(group).filter(
      (l) => getLeagueConfig(l).hasFeed,
    );
    if (groupLeagues.length === 0) return;
    const allSelected = groupLeagues.every((l) => selected.includes(l));
    if (allSelected) {
      onChange(selected.filter((l) => !groupLeagues.includes(l)));
    } else {
      onChange([...new Set([...selected, ...groupLeagues])]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {GROUP_ORDER.map((group) => {
        const leagues = getLeaguesByGroup(group);
        const feedLeagues = leagues.filter((l) => getLeagueConfig(l).hasFeed);
        const allSelected =
          feedLeagues.length > 0 && feedLeagues.every((l) => selected.includes(l));
        const someSelected = leagues.some((l) => selected.includes(l));
        const groupEmpty = feedLeagues.length === 0;
        return (
          <div key={group} className="flex items-center gap-1">
            <Button
              variant={allSelected ? "default" : someSelected ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggleGroup(group)}
              disabled={groupEmpty}
              className="h-7 text-xs font-medium"
              title={groupEmpty ? "Aucune source de matchs câblée pour ce groupe" : undefined}
            >
              {GROUP_LABELS[group]}
            </Button>
            <div className="flex flex-wrap gap-0.5">
              {leagues.map((league) => {
                const cfg = getLeagueConfig(league);
                const isSelected = selected.includes(league);
                return (
                  <Button
                    key={league}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => cfg.hasFeed && toggleLeague(league)}
                    disabled={!cfg.hasFeed}
                    title={
                      cfg.hasFeed
                        ? cfg.label
                        : `${cfg.label} — catalogue 1xbet, source de matchs à venir`
                    }
                    className={cn(
                      "h-7 text-xs",
                      isSelected && "bg-primary/20 text-primary",
                      !cfg.hasFeed && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {cfg.shortLabel}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
