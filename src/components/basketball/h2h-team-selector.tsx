"use client";

import { cn } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useH2HTeams } from "@/hooks/use-h2h-teams";
import type { H2HTeam } from "@/lib/types/basketball-h2h";

type H2HTeamSelectorProps = {
  league: "nba" | "wnba";
  teamAId: string | null;
  teamBId: string | null;
  onTeamAChange: (id: string) => void;
  onTeamBChange: (id: string) => void;
  onSwap: () => void;
  className?: string;
};

export function H2HTeamSelector({
  league,
  teamAId,
  teamBId,
  onTeamAChange,
  onTeamBChange,
  onSwap,
  className,
}: H2HTeamSelectorProps) {
  const { teams, isLoading } = useH2HTeams(league);

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <TeamSelect
        teams={teams}
        value={teamAId}
        onChange={onTeamAChange}
        placeholder="Équipe A"
        isLoading={isLoading}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
        onClick={onSwap}
        aria-label="Inverser les équipes"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </Button>
      <TeamSelect
        teams={teams}
        value={teamBId}
        onChange={onTeamBChange}
        placeholder="Équipe B"
        isLoading={isLoading}
      />
    </div>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
  placeholder,
  isLoading,
}: {
  teams: H2HTeam[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder: string;
  isLoading: boolean;
}) {
  const selected = teams.find((t) => t.id === value);

  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger className="w-[180px] h-9 text-xs font-mono">
        <SelectValue>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.logo && (
                <img
                  src={selected.logo}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              )}
              {selected.abbr}
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id} className="text-xs font-mono">
            <span className="flex items-center gap-2">
              {team.logo && (
                <img
                  src={team.logo}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              )}
              {team.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
