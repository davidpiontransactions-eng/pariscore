"use client";

import { cn } from "@/lib/utils";

type TournamentBadgeProps = {
  category?: string;
  className?: string;
};

const BADGE_MAP: Record<string, { label: string; className: string }> = {
  "Grand Slam": { label: "GS", className: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  "ATP Masters 1000": { label: "M1000", className: "text-sky-600 bg-sky-500/10 border-sky-500/30" },
  "ATP 500": { label: "500", className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  "ATP 250": { label: "250", className: "text-slate-600 bg-slate-500/10 border-slate-500/30" },
  Challenger: { label: "CH", className: "text-violet-600 bg-violet-500/10 border-violet-500/30" },
  ITF: { label: "ITF", className: "text-neutral-600 bg-neutral-500/10 border-neutral-500/30" },
};

export function TournamentBadge({ category, className }: TournamentBadgeProps) {
  const badge = BADGE_MAP[category ?? ""] ?? {
    label: category ?? "Match",
    className: "text-muted-foreground bg-muted/30 border-border/60",
  };
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none", badge.className, className)}>
      {badge.label}
    </span>
  );
}