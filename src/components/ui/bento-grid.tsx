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
        "grid gap-[var(--bento-gap)]",
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
        "rounded-[var(--bento-radius)] p-6",
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
