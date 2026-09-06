"use client";

import { useEffect, useRef } from "react";

/**
 * useConfettiAnimation — Animation CSS-only confetti pour célébration prédiction.
 *
 * Patterns supportés :
 * - conic-gradient rotation (légère, GPU-accélérée)
 * - keyframes pulse + scale
 *
 * Usage :
 *   const ref = useConfettiAnimation({
 *     iterationCount: 1,        // jouer une fois
 *     duration: "var(--mi-confetti-duration)", // 3s par défaut
 *   });
 *
 *   return <div ref={ref} className="confetti">Félicitations !</div>
 *
 * Tout est CSS-only : pas de canvas, pas de JS animation loop.
 * Respecte automatically prefers-reduced-motion via parent ReducedMotionProvider.
 */
export function useConfettiAnimation(
  opts: {
    iterationCount?: string;
    duration?: string;
  } = {}
) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Styles de base confetti
    element.style.animationDuration = opts.duration || "var(--mi-confetti-duration, 3s)";
    element.style.animationIterationCount = opts.iterationCount || "var(--mi-confetti-iteration-count, 1)";
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.position = "relative";

    // Injecter les keyframes conic-gradient si pas déjà présentes
    const alreadyExists = Array.from(document.head.querySelectorAll("style"))
      .some((s) => s.textContent.includes("mi-confetti-keyframes"));

    if (!alreadyExists) {
      const style = document.createElement("style");
      style.textContent = `
        @keyframes mi-confetti-keyframes {
          0%   { transform: rotate(0deg) scale(1); opacity: 1; }
          33%  { transform: rotate(120deg) scale(1.2); opacity: 0.8; }
          66%  { transform: rotate(240deg) scale(1.1); opacity: 0.6; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.4; }
        }
        .mi-confetti {
          position: absolute;
          inset: 0;
          border-radius: var(--mi-border-radius, 4px);
          background: var(--mi-confetti-color, #00e676);
          animation: mi-confetti-keyframes var(--mi-confetti-duration, 3s) var(--mi-animation-easing, cubic-bezier(0.4, 0, 0.2, 1)) var(--mi-confetti-iteration-count, 1) both;
          will-change: transform, opacity;
        }
      `;
      document.head.appendChild(style);
    }

    // Ajouter la classe confetti
    element.classList.add("mi-confetti");

    return () => {
      if (element) {
        element.classList.remove("mi-confetti");
      }
    };
  }, [opts.duration, opts.iterationCount]);

  return ref;
}

export default useConfettiAnimation;