"use client";

import { forwardRef, type ReactNode } from "react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { cn } from "@/lib/utils";
import { useLiquidGlass, type LgTier } from "@/hooks/use-liquid-glass";

type SportTint =
  | "tennis"
  | "football"
  | "mma"
  | "cycling"
  | "f1"
  | "cs2"
  | "basketball"
  | "rugby";

interface LiquidGlassProps {
  children: ReactNode;
  tier?: LgTier;
  elevated?: boolean;
  sport?: SportTint;
  noSheen?: boolean;
  className?: string;
  as?: React.ElementType;
  [key: string]: unknown;
}

/**
 * Composant wrapper Liquid Glass.
 *
 * Applique le glass morphism avec :
 * - Détection auto des capacités navigateur (useLiquidGlass)
 * - Override manuel de tier possible
 * - Sport accent tint
 * - Option noSheen pour masquer le gradient lens
 */
export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(
  function LiquidGlass(
    {
      children,
      tier: tierOverride,
      elevated = false,
      sport,
      noSheen = false,
      className,
      as: Component = "div",
      ...props
    },
    ref
  ) {
    const flagEnabled = useFeatureFlagEnabled("liquid-glass-v1");
    const caps = useLiquidGlass();
    const effectiveTier = tierOverride ?? caps.tier;

    // Feature flag PostHog — rollout 0% par défaut, safety net
    if (!flagEnabled) {
      return (
        <Component ref={ref} className={className} {...props}>
          {children}
        </Component>
      );
    }

    // Ne pas render si glass off
    if (effectiveTier === "off") {
      return (
        <Component ref={ref} className={className} {...props}>
          {children}
        </Component>
      );
    }

    return (
      <Component
        ref={ref}
        className={cn(
          // Base glass class
          elevated ? "glass-liquid-elevated" : "glass-liquid",
          // Sport tint
          sport && `glass-${sport}`,
          // NoSheen masque le ::after (lens gradient)
          noSheen && "lg-no-sheen",
          // Classe externe
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
