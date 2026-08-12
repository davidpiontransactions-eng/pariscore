"use client";

import { useState } from "react";
import type { TeamRecord } from "@/lib/baseball/types";

interface TeamLogoProps {
  team: Pick<TeamRecord, "code" | "name" | "primaryColor" | "secondaryColor" | "logoPath">;
  size?: number;
  className?: string;
}

/**
 * Logo d'équipe servi depuis le cache VPS /public/cache/baseball-teams/.
 * Fallback instantané : monogramme SVG aux couleurs officielles (aucune
 * image cassée possible — règle QA "zéro donnée factice").
 */
export function TeamLogo({ team, size = 34, className }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !team.logoPath) {
    return (
      <span
        aria-label={team.name}
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${team.primaryColor} 55%, ${team.secondaryColor} 140%)`,
          fontSize: size * 0.32,
          boxShadow: `inset 0 0 0 2px ${team.secondaryColor}33`,
        }}
      >
        {team.code.slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      src={team.logoPath}
      alt={team.name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
