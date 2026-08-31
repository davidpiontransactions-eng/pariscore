"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle, PopoverDescription } from "@/components/ui/popover";

type SurfaceBadgeProps = {
  surface: string;
  className?: string;
};

/**
 * Surface icons and colors — terre battue = clay, gazon = grass, hard court
 */
const SURFACE_COLORS: Record<string, string> = {
  Clay: "bg-green-100 text-green-800",
  "Terre battue": "bg-green-100 text-green-800",
  Claycourt: "bg-green-100 text-green-800",
  Grass: "bg-yellow-100 text-amber-800",
  Gazon: "bg-yellow-100 text-amber-800",
  Grasscourt: "bg-yellow-100 text-amber-800",
  Hard: "bg-gray-100 text-gray-800",
  Hardcourt: "bg-gray-100 text-gray-800",
  Indoor: "bg-gray-100 text-gray-800",
};

type SurfaceBadgeWithPopupProps = SurfaceBadgeProps & {
  /** Player name for tooltip context */
  playerName?: string;
  /** Player's surface Elo differential (positive = favors this surface) */
  eloDifferential?: number;
  /** Surface-specific win probability adjustment (percentage points) */
  probAdjustment?: number;
  /** Opponent's H2H record on this surface */
  h2hRecord?: string;
};

/**
 * SurfaceBadge — Badge de surface avec popup contextuel
 *
 * Affiche le type de surface (terre battue/clay, gazon/grass, dur/hard)
 * avec icône et couleur codifiée. Au survol, affiche un popover avec:
 * - Differential Elo du joueur sur cette surface
 * - Ajustement de probabilité de gain
 * - Historique H2H contre adversaires
 */
export function SurfaceBadge({
  surface,
  className,
  playerName,
  eloDifferential,
  probAdjustment,
  h2hRecord,
}: SurfaceBadgeWithPopupProps) {
  const [isHovered, setIsHovered] = useState(false);

  const surfaceDisplay = surface
    .toString()
    .replace(/^(CL|TR|GR|HA|IN)/i, (prefix) => {
      const lower = surface.toLowerCase();
      if (lower.includes("clay") || lower.includes("terre") || lower.includes("terrib")) return "Terre battue";
      if (lower.includes("grass") || lower.includes("gazon") || lower.includes("herb")) return "Gazon";
      if (lower.includes("hard") || lower.includes("dur")) return "Dur";
      return surface;
    });

  const colorClass = SURFACE_COLORS[surface] ?? "bg-gray-100 text-gray-800";

  // Tooltip content with surface stats
  const tooltipContent = playerName
    ? (
      <div className="space-y-1.5 text-xs">
        <span className="font-medium">Joueur</span>
        <span className="font-mono">{playerName}</span>
        {eloDifferential !== undefined && (
          <div>
            <span className="font-medium">Differential Elo</span>
            <span className={eloDifferential > 0 ? "text-green-600" : "text-red-600"}>
              {Number(eloDifferential).toFixed(1)}
            </span>
            {` points ${eloDifferential > 0 ? "favorise" : "défavorise"} ce surface`}
          </div>
        )}
        {probAdjustment !== undefined && (
          <div>
            <span className="font-medium">Ajustement prob.</span>
            <span className={probAdjustment > 0 ? "text-green-600" : "text-red-600"}>
              {Number(probAdjustment).toFixed(1)}%
            </span>
            {` au gain attendu`}
          </div>
        )}
        {h2hRecord && (
          <div>
            <span className="font-medium">H2H</span>
            <span className="font-mono">{h2hRecord}</span>
          </div>
        )}
      </div>
    )
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none text-muted-foreground",
            colorClass,
            " hover:bg-card/50 transition-colors",
            "data-[state=hover]:ring-2 ring-primary/20"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={`Surface ${surfaceDisplay} — ${playerName || ""}`}
        >
          <span aria-hidden="true">
            {surfaceDisplay.slice(0, 2)}
          </span>
          <span>{surfaceDisplay}</span>
        </span>
      </TooltipTrigger>
      {isHovered && (
        <Popover>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>{playerName || "Analyse surface"}</PopoverTitle>
              <PopoverDescription>Statistiques sur {surfaceDisplay}</PopoverDescription>
            </PopoverHeader>
            {tooltipContent}
            {(!playerName || eloDifferential === undefined) && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span>Survoler un joueur pour voir les détails</span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </Tooltip>
  );
}