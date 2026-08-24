"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TIME_RANGE_OPTIONS, type TimeFilterKey } from "@/lib/match-view";

type Props = {
  /** Clé de fenêtre active (« all » = toutes les heures, « today » = jour calendaire). */
  value: TimeFilterKey;
  onChange: (key: TimeFilterKey) => void;
  className?: string;
};

/**
 * TimeRangeFilter — filtre par heure de début (1h / 2h / 4h / 6h / 12h / 24h
 * / Aujourd'hui / Demain). Fenêtre glissante à partir de maintenant (tolérance
 * arrière 15 min, cf. `filterByStartWindow` dans src/lib/match-view.ts) ;
 * « today » / « tomorrow » couvrent les jours calendaires locaux
 * (`filterByToday` / `filterByTomorrow`).
 *
 * Source de vérité : le store sidebar (`useSportsSidebarStore.selectedTimeFilter`)
 * pour les onglets couplés — ce composant n'est qu'un contrôleur déporté.
 *
 * Accessibilité : group de boutons « chip » avec aria-pressed ; responsive
 * (wrap + scroll horizontal sur mobile).
 */
export function TimeRangeFilter({ value, onChange, className }: Props) {
  const t = useTranslations("matchTabs");

  const options: Array<{ key: TimeFilterKey; label: string }> = [
    { key: "all", label: t("timeAll") },
    ...TIME_RANGE_OPTIONS.map((hours) => ({
      key: `${hours}h` as TimeFilterKey,
      label: t("timeHour", { hours }),
    })),
    { key: "today", label: t("timeToday") },
    { key: "tomorrow", label: t("timeTomorrow") },
  ];

  return (
    <div
      role="group"
      aria-label={t("timeFilterLabel")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {t("timeFilterLabel")} :
      </span>
      {options.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
