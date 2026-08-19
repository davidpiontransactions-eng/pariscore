"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Key du score courant ("6-4 3-2" / "2-1") — chaque changement rejoue le flash. */
  scoreKey: string;
  children: ReactNode;
  className?: string;
  /** Props passées au span rendu (aria-label, role, style…). */
  "aria-label"?: string;
  role?: string;
  style?: React.CSSProperties;
};

/**
 * ScoreFlash — annonce visuelle d'un changement de score.
 *
 * À chaque `scoreKey` nouveau (point gagné, set terminé, but marqué), le
 * contenu fait un léger scale + un fondu bref : l'œil sait *où* le match a
 * bougé sans avoir à scanner la carte. Durée courte (450ms) et ease
 * emphasized — un moment authoré, pas un roll continu (anti-digit-roll,
 * DESIGN.md).
 *
 * Respecte `prefers-reduced-motion` via framer-motion.
 */
export function ScoreFlash({
  scoreKey,
  children,
  className,
  "aria-label": ariaLabel,
  role,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      key={scoreKey}
      className={cn("inline-flex items-baseline", className)}
      style={style}
      aria-label={ariaLabel}
      role={role}
      initial={reduceMotion ? false : { scale: 1.1, opacity: 0.55 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.45,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.span>
  );
}