"use client";

import { cn } from "@/lib/utils";

type Props = {
  decimal: number;
  bookmaker: string;
  className?: string;
};

/**
 * Affiche la meilleure cote trouvée pour un joueur :
 *   @2.10  Bet365
 * Composant atomique extrait de l'ancien PlayerBlock (15 props → slots).
 */
export function BestOddBadge({ decimal, bookmaker, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px]",
        className
      )}
    >
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        @{decimal.toFixed(2)}
      </span>
      <span className="text-muted-foreground">{bookmaker}</span>
    </div>
  );
}
