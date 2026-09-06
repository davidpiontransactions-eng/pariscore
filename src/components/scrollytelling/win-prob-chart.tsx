"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface WinProbChartProps {
  probA: number;
  probB: number;
  player1Name: string;
  player2Name: string;
  className?: string;
}

export function WinProbChart({ probA, probB, player1Name, player2Name, className }: WinProbChartProps) {
  const reducedMotion = useReducedMotion();

  // CSS scroll-driven animation
  const hasAnimation = !reducedMotion
    ? "animation: reveal-up linear both; animation-timeline: view(); animation-range: entry 0% entry 45%;"
    : "";

  return (
    <div
      className={cn("win-prob-chart", className)}
      style={{ height: "200px", width: "100%", ...(hasAnimation ? { animation: hasAnimation } : {}) }}
    >
      <h3 className="text-sm text-zinc-400">Probabilité de victoire</h3>
      <p className="text-xs text-zinc-500">
        {probA}% vs {probB}% — CSS scroll-driven
      </p>
    </div>
  );
}