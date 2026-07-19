"use client";

import { Plus } from "lucide-react";
import { ProbabilityRing } from "./probability-ring";
import { cn } from "@/lib/utils";

type Props = {
  /** Probabilité de victoire (0-100). */
  prob: number;
  /** Couleur hex du joueur (cercle + anneau). */
  color: string;
  /** Texte du label "Win" sous le pourcentage. */
  winLabel: string;
  /** Mode terminal : anneau plus compact (72px vs 92px). */
  terminalMode?: boolean;
  /** Callback quick-add. Absent = pas de bouton +. */
  onQuickAdd?: () => void;
  /** Label a11y pour le bouton +. */
  quickAddLabel?: string;
  className?: string;
};

/**
 * Combinaison ProbabilityRing + bouton quick-add (+).
 * Composant atomique extrait de l'ancien PlayerBlock (15 props → slots).
 */
export function QuickAddRing({
  prob,
  color,
  winLabel,
  terminalMode = false,
  onQuickAdd,
  quickAddLabel,
  className,
}: Props) {
  return (
    <div className={cn("relative mt-3 inline-block", className)}>
      <ProbabilityRing
        value={prob}
        size={terminalMode ? 72 : 92}
        stroke={terminalMode ? 6 : 7}
        color={color}
        trackColor="currentColor"
      >
        <span
          className={cn(
            "font-bold tabular-nums",
            terminalMode ? "text-base" : "text-xl"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {prob}%
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {winLabel}
        </span>
      </ProbabilityRing>
      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label={quickAddLabel}
          title={quickAddLabel}
          className={cn(
            "absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full",
            "border-2 border-background bg-emerald-600 text-white shadow-md",
            "transition-all hover:scale-110 hover:bg-emerald-700",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
