"use client"

import * as React from "react"
import {
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

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
}: BentoGridProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(
        // `min-w-0 max-w-full` : sans cela, la piste `grid-cols-1` a un minimum
        // `auto` = max-content, et UN descendant large (rangée de filtres,
        // tableau) élargit la grille au-delà du viewport → débordement
        // horizontal de toute la page en viewport étroit.
        // `overflow-x-clip` (et non `-hidden`) : `clip` ne crée pas de conteneur
        // de défilement, donc `position: sticky` des descendants continue de
        // fonctionner — `-hidden` le casserait.
        "grid w-full min-w-0 max-w-full gap-[var(--bento-gap)] overflow-x-clip",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
        rows === "fixed" && "auto-rows-[200px]",
        rows === "auto" && "auto-rows-min",
        className
      )}
      variants={prefersReducedMotion ? undefined : containerVariants}
      initial={prefersReducedMotion ? undefined : "hidden"}
      animate="show"
    >
      {children}
    </motion.div>
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
}: BentoTileProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(
        /* Grid spanning */
        size === "hero" && "md:col-span-2 md:row-span-2",
        size === "wide" && "md:col-span-2",
        size === "tall" && "md:row-span-2",
        /* standard + small = 1×1 (no span) */

        /* Visual */
        // `min-w-0` : item de grille, sinon son minimum `auto` l'empêche de
        // rétrécir sous la largeur de son contenu (débordement horizontal).
        "min-w-0 rounded-[var(--bento-radius)] p-4 sm:p-6",
        "transition-all duration-[var(--bento-transition)]",

        /* Variant */
        variant === "glass" && "glass-liquid",
        variant === "solid" && "bg-card border border-border",
        variant === "accent" && "bg-accent/10 border border-accent/20",

        /* Interactive */
        interactive && "cursor-pointer",

        className
      )}
      variants={prefersReducedMotion ? undefined : itemVariants}
      whileInView={prefersReducedMotion ? undefined : "show"}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={
        interactive && !prefersReducedMotion
          ? { scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }
          : undefined
      }
    >
      {children}
    </motion.div>
  )
}
