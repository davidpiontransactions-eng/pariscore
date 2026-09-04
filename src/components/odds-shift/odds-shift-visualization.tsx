"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ChevronUp, ChevronDown, Equal, XCircle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";


type OddsShiftProps = {
  /** Current probability percentage (0-100) */
  probability: number;
  /** Previous probability percentage (0-100, optional) */
  previousProbability?: number;
  /** Sport identifier for color tint */
  sport?: "football" | "tennis" | "basketball" | "mma" | "cycling" | "f1" | "baseball" | "rugby";
  /** On shift change callback */
  onShiftChange?: (shift: "up" | "down" | "stable", color: string) => void;
};

/**
 * OddsShiftVisualization — Visualisation en temps réel des variations de cotes.
 *
 * Affiche une petite flèche indicatrice à côté de la probabilité en direct :
 * - ↗️ cotes en hausse (marché s'éloignant du modèle)
 * - ↘️ cotes en baisse (marché s'approchant du modèle)
 * - ➡️ cotes stables
 * - Couleur : vert = variation favorable, rouge = variation défavorable
 * - Pulse subtil seulement quand la variation > 5%
 */
export function OddsShiftVisualization({
  probability,
  previousProbability,
  sport,
  onShiftChange,
}: OddsShiftProps) {
  const [shift, setShift] = useState<"up" | "down" | "stable">("stable");
  const [shiftColor, setShiftColor] = useState<string>("");
  const t = useTranslations("odds");

  // Calculer le shift au montage et aux mises à jour
  useEffect(() => {
    if (previousProbability === undefined) {
      setShift("stable");
      setShiftColor("");
      return;
    }

    const diff = probability - previousProbability;
    const absDiff = Math.abs(diff);

    let newShift: "up" | "down" | "stable" = "stable";
    let newColor = "";

    if (absDiff > 5) {
      newShift = diff > 0 ? "up" : "down";
      newColor = diff > 0 ? "red" : "green";
    } else {
      newShift = "stable";
      newColor = "";
    }

    setShift(newShift);
    setShiftColor(newColor);
    onShiftChange?.(newShift, newColor);
  }, [probability, previousProbability, onShiftChange]);

  // Déterminer la flèche et la couleur selon le sport
  const getSportColor = (sport: string | undefined): string => {
    const sportColors: Record<string, string> = {
      football: "#0ea5e9",
      tennis: "#10b981",
      basketball: "#fbbf24",
      mma: "#ef4444",
      cycling: "#f59e0b",
      f1: "#dc2626",
      baseball: "#f59e0b",
      rugby: "#14b8a6",
    };
    return sportColors[sport ?? ""] || "currentColor";
  };

  const sportColor = getSportColor(sport);

  // Animation subtile quand il y a un shift significatif
  const animateClass = shift !== "stable" ? "transition-colors duration-300" : "";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "text-xs font-medium",
          "transition-colors duration-300",
          animateClass,
          "relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:text-xs after:pointer-events-none"
        )}
        style={{ color: shiftColor || sportColor }}
      >
        {shift === "up"
          ? <ChevronUp className="h-3.5 w-3.5" />
          : shift === "down"
          ? <ChevronDown className="h-3.5 w-3.5" />
          : <Equal className="h-3.5 w-3.5" />
        }
      </span>

      <span
        className="text-[10px] opacity-70"
        title={shift === "up"
          ? t("odds_increasing")
          : shift === "down"
          ? t("odds_decreasing")
          : t("odds_stable")}
      >
        {probability.toFixed(1)}
      </span>
    </div>
  );
}