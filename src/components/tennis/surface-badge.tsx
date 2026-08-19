"use client";

import { cn } from "@/lib/utils";

type SurfaceBadgeProps = {
  surface: string;
  className?: string;
};

const SURFACE_ICONS: Record<string, string> = {
  Dur: "🟦",
  "Terre battue": "🟠",
  Gazon: "🟢",
  Hard: "🟦",
  Clay: "🟠",
  Grass: "🟢",
};

export function SurfaceBadge({ surface, className }: SurfaceBadgeProps) {
  const icon = SURFACE_ICONS[surface] ?? "🎾";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{surface}</span>
    </span>
  );
}