import * as React from "react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  BentoGrid — CSS Grid container with responsive column presets      */
/* ------------------------------------------------------------------ */

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4
  rows?: "auto" | "fixed"
}

export function BentoGrid({
  cols = 4,
  rows = "auto",
  className,
  children,
  ...props
}: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid gap-[var(--bento-gap)]",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
        rows === "fixed" && "auto-rows-[200px]",
        rows === "auto" && "auto-rows-min",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BentoTile — Single cell with size/variant/interactive props        */
/* ------------------------------------------------------------------ */

interface BentoTileProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "hero" | "wide" | "standard" | "tall" | "small"
  variant?: "glass" | "solid" | "accent"
  interactive?: boolean
}

export function BentoTile({
  size = "standard",
  variant = "glass",
  interactive = false,
  className,
  children,
  ...props
}: BentoTileProps) {
  return (
    <div
      className={cn(
        /* Grid spanning */
        size === "hero" && "md:col-span-2 md:row-span-2",
        size === "wide" && "md:col-span-2",
        size === "tall" && "md:row-span-2",
        /* standard + small = 1×1 (no span) */

        /* Visual */
        "rounded-[var(--bento-radius)] p-6",
        "transition-all duration-[var(--bento-transition)]",

        /* Variant */
        variant === "glass" && "liquid-glass--clear",
        variant === "solid" && "bg-card border border-border",
        variant === "accent" && "bg-accent/10 border border-accent/20",

        /* Interactive */
        interactive &&
          "cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:border-white/10",

        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
