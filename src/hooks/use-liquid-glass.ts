"use client";

import { useEffect, useState } from "react";

export type LgTier = "off" | "tier0" | "tier1" | "tier2" | "clear" | "regular" | "elevated";

interface LgCapabilities {
  tier: LgTier;
  hasBackdropFilter: boolean;
  hasRefraction: boolean;
  hasGeometricLens: boolean;
  prefersReducedMotion: boolean;
  prefersReducedTransparency: boolean;
}

/**
 * Hook de détection des capacités navigateur pour Liquid Glass.
 *
 * Retourne le tier maximal supporté :
 * - "off": glass désactivé (reduced-motion, navigateur basique)
 * - "tier0": backdrop-filter + saturate minimal
 * - "tier1": SVG refraction (Chromium avec data-lg-refraction)
 * - "tier2": geometric lens (gradient incident + noise)
 */
export function useLiquidGlass(): LgCapabilities {
  const [caps, setCaps] = useState<LgCapabilities>({
    tier: "off",
    hasBackdropFilter: false,
    hasRefraction: false,
    hasGeometricLens: false,
    prefersReducedMotion: false,
    prefersReducedTransparency: false,
  });

  useEffect(() => {
    // Détection backdrop-filter
    const hasBackdropFilter = CSS.supports("backdrop-filter", "blur(8px)");

    // Détection reduced-motion
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReducedMotion = mqMotion.matches;

    // Détection reduced-transparency
    const mqTransparency = window.matchMedia(
      "(prefers-reduced-transparency: reduce)"
    );
    const prefersReducedTransparency = mqTransparency.matches;

    // Détection SVG refraction (Tier 1)
    // Chromium supporte data-lg-refraction via le système de tokens
    const hasRefraction =
      hasBackdropFilter &&
      !prefersReducedMotion &&
      document.documentElement.hasAttribute("data-lg-refraction");

    // Détection geometric lens (Tier 2)
    // Basé sur : backdrop-filter + !reduced-motion + !reduced-transparency
    const hasGeometricLens =
      hasBackdropFilter &&
      !prefersReducedMotion &&
      !prefersReducedTransparency;

    // Calcul du tier maximal
    let tier: LgTier = "off";
    if (!prefersReducedMotion && hasBackdropFilter) {
      tier = "tier0";
      if (hasRefraction) tier = "tier1";
      if (hasGeometricLens) tier = "tier2";
    }

    setCaps({
      tier,
      hasBackdropFilter,
      hasRefraction,
      hasGeometricLens,
      prefersReducedMotion,
      prefersReducedTransparency,
    });

    // Écouter les changements de prefers-reduced-motion
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCaps((prev) => ({ ...prev, tier: "off", prefersReducedMotion: true }));
      }
    };

    mqMotion.addEventListener("change", handleMotionChange);
    return () => mqMotion.removeEventListener("change", handleMotionChange);
  }, []);

  return caps;
}
