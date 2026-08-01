"use client";

import type { LocationFilter } from "@/lib/league-stats";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function LeagueLocationTabs({
  value,
  onChange,
}: {
  value: LocationFilter;
  onChange: (v: LocationFilter) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as LocationFilter)}
      className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1"
    >
      <ToggleGroupItem
        value="all"
        className="rounded-md px-4 py-1.5 text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
      >
        Tous
      </ToggleGroupItem>
      <ToggleGroupItem
        value="home"
        className="rounded-md px-4 py-1.5 text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
      >
        À domicile
      </ToggleGroupItem>
      <ToggleGroupItem
        value="away"
        className="rounded-md px-4 py-1.5 text-xs font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
      >
        En déplacement
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
