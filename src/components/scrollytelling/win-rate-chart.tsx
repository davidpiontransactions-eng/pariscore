"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface WinRateChartProps {
  className?: string;
}

export function WinRateChart({ className }: WinRateChartProps = {}) {
  const reducedMotion = useReducedMotion();

  // CSS scroll-driven animation
  const hasAnimation = !reducedMotion
    ? "animation: reveal-up linear both; animation-timeline: view(); animation-range: entry 0% entry 45%;"
    : "";

  return (
    <div
      className={cn("win-rate-chart", className)}
      style={{ height: "300px", width: "100%", ...(hasAnimation ? { animation: hasAnimation } : {}) }}
    >
      <h3 className="text-sm text-zinc-400">Évolution du taux de victoire</h3>
      <p className="text-sm text-zinc-500">
        CSS scroll-driven — aucune dépendance JavaScript
      </p>
    </div>
  );
}