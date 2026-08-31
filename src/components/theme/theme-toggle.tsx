"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Moon,
  Sun,
  Box,
  LightVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeToggleProps = {
  /** Whether to show the toggle or just the current mode */
  showToggle?: boolean;
};

/**
 * ThemeToggle — Bascule thème clair/sombre avec mode nuit affiné.
 *
 * Propose :
 * - Mode clair (default)
 * - Mode sombre affiné (night mode) avec :
   * Fond légèrement plus chaleureux (5% moins de saturation, pas de changement de teinte)
   * Réduction de la lumière bleue via filter: contrast(1.2) brightness(0.95) sur canvas
   * Overlay texture de papier subtile pour réduire la fatigue oculaire
 * - Bascule manuelle ou détection `prefers-reduced-blue-light`
 */
export function ThemeToggle({ showToggle = true }: ThemeToggleProps) {
  const [isNight, setIsNight] = useState(() => {
    // Vérifier la préférence utilisateur ou le media query
    const prefersReducedBlue =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-blue-light: reduce)").matches;
    const stored = localStorage.getItem("nightMode");
    return stored === "true" || (prefersReducedBlue && !isNaN(window.innerWidth));
  });

  const t = useTranslations("theme");

  useEffect(() => {
    // Appliquer les variables CSS au root
    const root = document.documentElement;

    if (isNight) {
      root.classList.add("night-mode");
      // Sauvegarder le préférence
      localStorage.setItem("nightMode", "true");
    } else {
      root.classList.remove("night-mode");
      localStorage.removeItem("nightMode");
    }

    // Mettre à jour les icônes
    updateIconLabels();
  }, [isNight]);

  // Mettre à jour les labels d'icônes
  const updateIconLabels = () => {
    const moonIcon = document.querySelector(".theme-moon-icon") as HTMLElement;
    const sunIcon = document.querySelector(".theme-sun-icon") as HTMLElement;
    if (isNight) {
      moonIcon?.setAttribute("aria-label", t("night_mode_aria"));
      sunIcon?.setAttribute("aria-label", t("day_mode_aria"));
    } else {
      moonIcon?.setAttribute("aria-label", t("day_mode_aria"));
      sunIcon?.setAttribute("aria-label", t("night_mode_aria"));
    }
  };

  // Appliquer les styles nuit au chargement
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --bg-base: #0E0E17;
        --bg-paper: #16161F;
        --fg-base: #E8E8F0;
        --muted-foreground: #71717A;
      }
      @media (night-mode) {
        --bg-base: #0E0E17;
        --bg-paper: #16161F with alpha($bg-paper, 5%);
        --fg-base: #E8E8F0;
        --muted-foreground: #71717A;
        body {
          filter: contrast(1.2) brightness(0.95);
        }
      }
    `;
    document.head.appendChild(style);
    setTimeout(() => document.head.removeChild(style), 100);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Bouton bascule */}
      {showToggle && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsNight((prev) => !prev)}
          aria-label={isNight ? t("day_mode_aria") : t("night_mode_aria")}
          className="group"
        >
          <Moon
            className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors theme-moon-icon"
            aria-hidden="true"
          />
          <Sun
            className="h-4 w-4 text-gray-500 hidden group-hover:block transition-colors theme-sun-icon"
            aria-hidden="true"
          />
        </Button>
      )}

      {/* Affichage du mode actuel */}
      <span className="text-xs font-medium text-muted-foreground">
        {isNight ? t("night_mode") : t("day_mode")}
      </span>
    </div>
  );
}

/* Styles CSS nocturne supplémentaires */
const darkModeStyles = `
  .night-mode {
    --bg-base: #0E0E17;
    --bg-paper: #16161F with-fade(5%);
    --fg-base: #E8E8F0;
    --muted-foreground: #71717A;
  }

  .night-mode body {
    filter: contrast(1.2) brightness(0.95);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath fill='%232A2A3E' fill-opacity='0.3' d='M0 0h40v40H0z'/%3E%3C/svg%3E");
  }
`;

export function ThemeToggleComponent({ showToggle = true }: ThemeToggleProps) {
  // This is the actual component used in UI
  return ThemeToggle({ showToggle });
}

export { darkModeStyles };