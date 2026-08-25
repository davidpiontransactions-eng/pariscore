"use client";

/**
 * DensityToggle — toggle "Compact / Confort" pour la densité d'affichage.
 *
 * Les parieurs habitués veulent la table dense (style Forebet/Bet365) ;
 * les nouveaux veulent des cards aérées (style Sofascore).
 * Stocké en localStorage, défaut = "confort".
 *
 * Pattern issu du rapport design 2026-08-25 (recommandation #10).
 */

import { useEffect, useState, useCallback } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pariscore-density";

export type Density = "compact" | "confort";

/** Hook pour lire le mode densité. Utilisable partout via `useDensity()`. */
export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensity] = useState<Density>("confort");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Density | null;
      if (stored === "compact" || stored === "confort") setDensity(stored);
    } catch {}
  }, []);

  const set = useCallback((d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(STORAGE_KEY, d);
      // Émet un event pour que les composants écoutants se mettent à jour
      window.dispatchEvent(new CustomEvent("density-change", { detail: d }));
    } catch {}
  }, []);

  return [density, set];
}

export function DensityToggle({ className }: { className?: string }) {
  const [density, setDensity] = useDensity();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/40 bg-zinc-900/60 p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setDensity("compact")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
          density === "compact"
            ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
            : "text-zinc-500 hover:text-zinc-300",
        )}
        title="Mode compact — densité maximale (style Forebet/Bet365)"
      >
        <Rows3 className="h-3 w-3" />
        Compact
      </button>
      <button
        type="button"
        onClick={() => setDensity("confort")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
          density === "confort"
            ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
            : "text-zinc-500 hover:text-zinc-300",
        )}
        title="Mode confort — cards aérées (style Sofascore)"
      >
        <LayoutGrid className="h-3 w-3" />
        Confort
      </button>
    </div>
  );
}
