"use client";

import { useTranslations } from "next-intl";
import type { MatchViewMode } from "@/lib/match-view";
import { cn } from "@/lib/utils";

type Props = {
  mode: MatchViewMode;
  className?: string;
};

/**
 * MatchEmptyState — état vide standard des onglets Live / Pre-match.
 *
 * Utilisé quand l'onglet actif n'a aucun match (ex. Live à 0 en pleine nuit,
 * fenêtre horaire sans match). Réutilisé par tous les tab-content sport.
 */
export function MatchEmptyState({ mode, className }: Props) {
  const t = useTranslations("matchTabs");
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium">
        {mode === "live" ? t("emptyLive") : t("emptyPrematch")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {mode === "live" ? t("emptyLiveHint") : t("emptyPrematchHint")}
      </p>
    </div>
  );
}