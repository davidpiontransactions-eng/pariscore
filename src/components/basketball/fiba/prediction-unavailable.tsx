"use client";

/**
 * PredictionUnavailable — état d'absence EXPLICITE de la couche prédictive FIBA.
 *
 * Remplace un chiffre absent par une raison. Un tiret « — » ou une probabilité
 * à 50 % se lisent comme une mesure ; le nom de la source manquante, non.
 *
 * Contrat : FIBA_PREDICTIONS_AVAILABLE (src/lib/predictions/fiba-predictions.ts).
 * Les scores, classements, calendriers etStatistics ESPN ne dépendent pas de ce
 * composant et restent affichés.
 */

import { cn } from "@/lib/utils";
import { FIBA_PREDICTIONS_UNAVAILABLE_REASON } from "@/lib/predictions/fiba-predictions";

export function PredictionUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 p-4 text-center",
        className,
      )}
      role="note"
    >
      <div className="text-xs font-semibold text-foreground">
        Prédiction indisponible
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {FIBA_PREDICTIONS_UNAVAILABLE_REASON}
      </p>
    </div>
  );
}