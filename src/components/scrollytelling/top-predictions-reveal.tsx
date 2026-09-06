"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Prediction {
  id: number;
  match: string;
  prediction: string;
  actualResult: string;
  correct: boolean;
  odd: number;
}

interface TopPredictionsRevealProps {
  predictions?: Prediction[];
}

export function TopPredictionsReveal({ predictions }: TopPredictionsRevealProps = {}) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const preds = predictions || [
    {
      id: 1,
      match: "PSG vs Marseille",
      prediction: "PSG victoire",
      actualResult: "PSG victoire 3-1",
      correct: true,
      odd: 1.85,
    },
    {
      id: 2,
      match: "Real Madrid vs Barcelona",
      prediction: "Real Madrid victoire",
      actualResult: "Match nul 2-2",
      correct: false,
      odd: 2.10,
    },
    {
      id: 3,
      match: "Man City vs Liverpool",
      prediction: "Man City victoire",
      actualResult: "Liverpool victoire 1-0",
      correct: true,
      odd: 1.95,
    },
  ];

  // CSS scroll-driven animation for prediction cards
  const cardStyle: React.CSSProperties = reducedMotion
    ? { opacity: 1, transform: "none" }
    : {
        animation: "reveal-up linear both",
        "animation-timeline": "view()",
        "animation-range": "entry 0% entry 50%",
      };

  return (
    <div
      ref={containerRef}
      className={cn("predictions-reveal", "space-y-4")}
      style={{ marginTop: "-2rem" }}
    >
      {preds.map((pred) => (
        <div
          key={pred.id}
          className={cn(
            "prediction-card",
            "bg-zinc-900/60",
            "border",
            "border-white/5",
            "rounded-xl",
            "p-4",
            "transition-colors",
            "hover:border-emerald-500/30",
            "scroll-reveal"
          )}
          style={cardStyle}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-white">{pred.match}</h4>
              <p className="text-sm text-zinc-400">{pred.prediction}</p>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-bold">{pred.odd}</span>
              <span className="text-zinc-500 text-xs">odd</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-400">{pred.actualResult}</p>
        </div>
      ))}
    </div>
  );
}