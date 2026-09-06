"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import type { Context } from "gsap";
import { initGSAP } from "@/lib/gsap-init";

/**
 * Hook pour créer un contexte GSAP avec cleanup automatique.
 * Appelle initGSAP() au montage.
 */
export function useGSAPContext(deps?: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<Context | null>(null);

  useGSAP(() => {
    initGSAP();
  }, { scope: containerRef, dependencies: deps });

  return { containerRef, context: contextRef };
}
