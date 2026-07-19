"use client";

import { cn } from "@/lib/utils";

const STAGE_TYPES = [
  { key: "", label: "Tous" },
  { key: "Flat", label: "Plat" },
  { key: "Hills", label: "Valloné" },
  { key: "Mountain", label: "Montagne" },
  { key: "ITT", label: "CLM" },
  { key: "TTT", label: "CLM/équipe" },
] as const;

type Props = {
  stageType: string;
  onStageTypeChange: (v: string) => void;
};

export function CyclingFilters({ stageType, onStageTypeChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGE_TYPES.map((f) => (
        <button
          key={f.key}
          onClick={() => onStageTypeChange(f.key)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            stageType === f.key
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
