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

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tier?: LgTier;
  elevated?: boolean;
  sport?: SportTint;
  noSheen?: boolean;
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
        <div ref={ref} className={className} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      );
    }

    // Ne pas render si glass off
    if (effectiveTier === "off") {
      return (
        <div ref={ref} className={className} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      );
    }

    return (
      <div
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
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    );
  }
);
