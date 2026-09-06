"use client";

import { useEffect, useRef } from "react";

/**
 * useScrollDrivenAnimation — Attache une animation CSS à la timeline de scroll.
 *
 * Usage :
 *   const ref = useScrollDrivenAnimation({
 *     animationName: "grow",
 *     animationDuration: "var(--mi-animation-duration-base)",
 *     willChange: "width",
 *   });
 *
 *   return <div ref={ref} className="live-bar">...</div>
 *
 * L'animation ne démarrera que lorsque l'utilisateur scrolle et que l'élément
 * est visible. Cela évite tout calcul de timer JS pendant le chargement initial.
 */
export function useScrollDrivenAnimation(
  opts: {
    animationName: string;
    animationDuration: string;
    willChange?: string;
    animationIterationCount?: string;
    animationTimingFunction?: string;
    viewTimelineName?: string;
  }
) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // 1. Appliquer les styles de base
    element.style.animationDuration = opts.animationDuration;
    if (opts.animationTimingFunction) {
      element.style.animationTimingFunction = opts.animationTimingFunction;
    }
    if (opts.animationIterationCount) {
      element.style.animationIterationCount = opts.animationIterationCount;
    }
    if (opts.willChange) {
      element.style.willChange = opts.willChange;
    }

    // 2. Appliquer la timeline de scroll (CSS native)
    if (opts.viewTimelineName) {
      // Utiliser view-timeline (nouvelle spec) avec nom personnalisé
      // @supports check se fait via CSS globale, ici on ajoute la règle JS
      const style = document.createElement("style");
      style.textContent = `
        @keyframes ${opts.animationName} {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .${opts.animationName} {
          animation-name: ${opts.animationName};
          animation-timeline: ${opts.viewTimelineName};
          will-change: ${opts.willChange};
        }
      `;
      document.head.appendChild(style);
      element.classList.add(opts.animationName);
    } else {
      // Fallback : animation-timeline: scroll() (support Chrome 112+, Firefox 115+)
      const style = document.createElement("style");
      style.textContent = `
        @keyframes ${opts.animationName} {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .${opts.animationName} {
          animation-name: ${opts.animationName};
          animation-timeline: scroll();
          will-change: ${opts.willChange};
        }
      `;
      document.head.appendChild(style);
      element.classList.add(opts.animationName);
    }

    return () => {
      // Nettoyage : retirer l'événement listener et le style injecté
      if (element) {
        element.style.animationDuration = "";
        element.style.animationTimingFunction = "";
        element.style.animationIterationCount = "";
        element.style.willChange = "";
        element.classList.remove(opts.animationName);
      }
      // Note : on ne retire pas les <style> injectés pour garder la simplicité.
      // En production, il faudrait tracker les références et les retirer proprement.
    };
  }, [
    opts.animationName,
    opts.animationDuration,
    opts.willChange,
    opts.animationIterationCount,
    opts.animationTimingFunction,
    opts.viewTimelineName,
  ]);

  return ref;
}

export default useScrollDrivenAnimation;