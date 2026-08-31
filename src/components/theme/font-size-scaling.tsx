"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Moon, Sun, TextSize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type FontSizePreset = "smaller" | "default" | "larger";

const FONT_SIZE_PRESETS: Record<FontSizePreset, number> = {
  smaller: 0.875,
  default: 1,
  larger: 1.125,
};

type FontSizeScalingProps = {
  /** Whether to show the preset toggles */
  showPresets?: boolean;
};

/**
 * FontSizeScaling — Préréglages de taille de police.
 *
 * Propose 3 tailles de police prédéfinies :
 * - Smaller (0.875rem) : plus de données à l'écran
 * - Default (1rem) : taille actuelle
 * - Larger (1.125rem) : lecture plus aisée
 *
 * Toutes les tailles de texte de l'interface utilisent
 * la variable CSS --font-size-base comme multiplicateur.
 */
export function FontSizeScaling({ showPresets = true }: FontSizeScalingProps) {
  const [selectedPreset, setSelectedPreset] = useState<FontSizePreset>("default");
  const t = useTranslations("font_size");

  // Appliquer la taille de police sélectionnée
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-size-base", FONT_SIZE_PRESETS[selectedPreset]);
  }, [selectedPreset]);

  return (
    <div className="flex items-center gap-2">
      {/* Bouton Smaller */}
      <Button
        variant={selectedPreset === "smaller" ? "default" : "ghost"}
        size="icon"
        onClick={() => setSelectedPreset("smaller")}
        aria-label={t("smaller_aria")}
        className="group"
      >
        <ZoomOut className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors text-xs" />
      </Button>

      {/* Taille actuelle */}
      <span className="text-xs font-medium text-muted-foreground">
        {t("current_size", { size: FONT_SIZE_PRESETS[selectedPreset].toFixed(3) })}
      </span>

      {/* Bouton Larger */}
      <Button
        variant={selectedPreset === "larger" ? "default" : "ghost"}
        size="icon"
        onClick={() => setSelectedPreset("larger")}
        aria-label={t("larger_aria")}
        className="group"
      >
        <ZoomIn className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors text-xs" />
      </Button>
    </div>
  );
}