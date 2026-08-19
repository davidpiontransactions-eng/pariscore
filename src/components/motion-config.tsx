"use client";

import { MotionConfig } from "framer-motion";

/**
 * Gate globale framer-motion : réduit les animations quand l'utilisateur
 * demande `prefers-reduced-motion` (une ligne, zéro régression).
 */
export function AppMotionConfig({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}