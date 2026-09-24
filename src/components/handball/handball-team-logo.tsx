"use client";

/**
 * HandballTeamLogo — badge local + fallback initiales (tokens dark, pas de hex).
 * Miroir du pattern hockey-team-logo (local-first, onError → initiales).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { teamLogoUrl } from "@/lib/handball-logos";

/** Initiales d'une équipe (2 lettres max, ex: "HBC Nantes" → "HN"). */
export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function HandballTeamLogo({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(name);

  if (!url || failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          "bg-muted text-[10px] font-bold text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
        title={name}
        aria-hidden
      >
        {teamInitials(name)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
