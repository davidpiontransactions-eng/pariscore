"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BasketballLeagueId } from "@/lib/basketball-data";
import { getLeagueConfig, getLeagueGroup, type LeagueGroup } from "@/lib/basketball-league-config";

type LeagueSelectorProps = {
  selected: BasketballLeagueId[];
  onChange: (leagues: BasketballLeagueId[]) => void;
  className?: string;
};

const GROUP_LABELS: Record<LeagueGroup, string> = {
  nba: "NBA/WNBA",
  euro: "Euro",
  domestic: "Domestique",
};

const GROUP_ORDER: LeagueGroup[] = ["nba", "euro", "domestic"];

export function LeagueSelector({ selected, onChange, className }: LeagueSelectorProps) {
  const toggleLeague = (league: BasketballLeagueId) => {
    if (selected.includes(league)) {
      onChange(selected.filter((l) => l !== league));
    } else {
      onChange([...selected, league]);
    }
  };

  const toggleGroup = (group: LeagueGroup) => {
    const groupLeagues = getGroupLeagues(group);
    const allSelected = groupLeagues.every((l) => selected.includes(l));
    if (allSelected) {
      onChange(selected.filter((l) => !groupLeagues.includes(l)));
    } else {
      const newSelected = [...new Set([...selected, ...groupLeagues])];
      onChange(newSelected);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {GROUP_ORDER.map((group) => {
        const leagues = getGroupLeagues(group);
        const allSelected = leagues.every((l) => selected.includes(l));
        const someSelected = leagues.some((l) => selected.includes(l));
        return (
          <div key={group} className="flex items-center gap-1">
            <Button
              variant={allSelected ? "default" : someSelected ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggleGroup(group)}
              className="h-7 text-xs font-medium"
            >
              {GROUP_LABELS[group]}
            </Button>
            <div className="flex gap-0.5">
              {leagues.map((league) => {
                const cfg = getLeagueConfig(league);
                const isSelected = selected.includes(league);
                return (
                  <Button
                    key={league}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => toggleLeague(league)}
                    className={cn(
                      "h-7 text-xs",
                      isSelected && "bg-primary/20 text-primary",
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

function getGroupLeagues(group: LeagueGroup): BasketballLeagueId[] {
  const all: BasketballLeagueId[] = ["nba", "wnba", "euroleague", "eurocup", "lnb", "acb", "lba", "bsl", "bbl", "aba", "greek"];
  return all.filter((l) => getLeagueGroup(l) === group);
}
