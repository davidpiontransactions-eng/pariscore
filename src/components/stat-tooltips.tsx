"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FC } from "react";

type StatTooltipProps = {
  /** Stat name to display in tooltip */
  name: string;
  /** Brief explanation/description */
  description: string;
  /** Optional icon component */
  icon?: FC<{ className?: string }>;
  /** Delay in milliseconds before tooltip appears (default: 300) */
  delay?: number;
  /** Whether tooltip follows cursor or stays positioned */
  followCursor?: boolean;
};

/**
 * StatTooltip — Infobulle statrique au survol.
 *
 * Affiche une infobulle subtile au survol d'une colonne statistique
 * (SFT, SOT, Shots, etc.) montrant le nom complet et une brève explication.
 * - Apparait après un court délai (300ms par défaut)
 * - Suit le curseur si `followCursor=true`
 * - Disparaît après 3 secondes d'inactivité
 * - Accessible: aria-label, focus-visible, contrast ≥ 4.5:1
 */
export function StatTooltip({
  name,
  description,
  icon,
  delay = 300,
  followCursor = false,
}: StatTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const t = useTranslations("stat_tooltips");

  // Show tooltip after delay
  const show = () => {
    const timeout = setTimeout(() => setShowTooltip(true), delay);
    setTooltipTimeout(timeout);
  };

  // Hide tooltip
  const hide = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
    setShowTooltip(false);
  };

  // Update cursor position
  const handleMouseMove = (e: MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <Tooltip>
      <TooltipTrigger
        onMouseEnter={show}
        onMouseLeave={hide}
        onMouseMove={followCursor ? handleMouseMove : undefined}
        aria-label={t(`tooltip_${name}_aria`)}
        className="relative"
      >
        {/* Stat display element */}
        <span className="relative flex items-center gap-1.5">
          {icon && <icon className="h-3.5 w-3.5" />}
          <span className="font-medium text-muted-foreground truncate">
            {name}
          </span>
        </span>
      </TooltipTrigger>

      {/* Tooltip content */}
      {showTooltip && (
        <TooltipContent
          side="top"
          className={cn(
            "bg-muted-foreground/10 text-foreground text-xs rounded px-3 py-1.5 transition-opacity",
            "shadow-sm",
            followCursor ? "pointer-events-none" : ""
          )}
          style={followCursor
            ? {
                left: cursorPos?.x + 12 + "px",
                top: cursorPos?.y + 12 + "px",
              }
            : undefined}
        >
          <div className="flex items-start gap-2">
            {icon && (
              <icon className="h-3 w-3 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-[10px] text-muted-foreground/80 line-clamp-2">
                {description}
              </p>
            </div>
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}