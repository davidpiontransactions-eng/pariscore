"use client";

import { cn } from "@/lib/utils";

/**
 * CagePattern — overlay translucide du motif chain-link octogonal.
 * Utilisé en background des sections MMA (tab, loading, error).
 */
export function CagePattern({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-40 dark:opacity-20",
        className
      )}
      style={{
        backgroundImage: "url('/img/mma-cage-pattern.svg')",
        backgroundRepeat: "repeat",
      }}
      aria-hidden
    />
  );
}
