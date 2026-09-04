"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook FPS auto-degrade : mesure les frames par seconde
 * et désactive le glass si < 30fps pendant 3 secondes.
 *
 * @param threshold - FPS minimum avant dégradation (défaut: 30)
 * @param windowMs - Fenêtre de mesure en ms (défaut: 3000)
 */
export function useFpsGuard(threshold = 30, windowMs = 3000) {
  const [isDegraded, setIsDegraded] = useState(false);
  const framesRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Ne pas mesurer si prefers-reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setIsDegraded(true);
      return;
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Enregistrer le timestamp de chaque frame
      framesRef.current.push(now);

      // Nettoyer les frames hors fenêtre
      const cutoff = now - windowMs;
      framesRef.current = framesRef.current.filter((t) => t > cutoff);

      // Calculer le FPS moyen sur la fenêtre
      const frameCount = framesRef.current.length;
      const avgFps = frameCount > 0 ? (frameCount / windowMs) * 1000 : 60;

      if (avgFps < threshold) {
        setIsDegraded(true);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [threshold, windowMs]);

  // Appliquer la classe .glass-off sur <html> quand dégradé
  useEffect(() => {
    const html = document.documentElement;
    if (isDegraded) {
      html.classList.add("glass-off");
    } else {
      html.classList.remove("glass-off");
    }

    return () => {
      html.classList.remove("glass-off");
    };
  }, [isDegraded]);

  return isDegraded;
}
