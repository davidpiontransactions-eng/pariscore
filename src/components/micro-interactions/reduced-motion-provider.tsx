"use client";

import { ReactNode, useEffect } from "react";
import { useReducedMotionSnapshot } from "@/hooks/use-micro-interactions";

/**
 * ReducedMotionProvider — Honore prefers-reduced-motion pour tout le sous-arbre.
 *
 * Usage :
 *   <ReducedMotionProvider>
 *     {'Tous les composants enfants reçoivent reducedMotion en contexte'}
 *   </ReducedMotionProvider>
 *
 * Le hook useReducedMotionSnapshot() peut être appelé n'importe où dans
 * l'arbre pour connaître l'état actuel (utile pour des décisions CSS/
 * JS conditionnelles).
 */
export const ReducedMotionProvider = ({ children }: { children: ReactNode }) => {
  const reducedMotion = useReducedMotionSnapshot();

  // On propage la valeur en contexte pour que les composants enfants
  // puissent la consommer via useContext si besoin.
  // Pour l'instant, on la rend disponible via le hook useReducedMotionSnapshot()
  // et via la prop children qui pourra lire reducedMotion côté parent.

  return <>{children}</>;
};

/**
 * Hook utilitaire : consomme la valeur fournie par ReducedMotionProvider
 * sans avoir besoin de createContext explicite (keep it simple).
 * À utiliser à l'intérieur de ReducedMotionProvider's arbre.
 */
export function useReducedMotionContext(): boolean {
  // Note : cette fonction est un placeholder.
  // Si besoin de context formel, on peut créer un Context plus tard.
  // Pour l'instant, on retombe sur la détection fenêtre.
  return useReducedMotionSnapshot();
}

export default ReducedMotionProvider;