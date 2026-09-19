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
  /** Options de filtre horaire personnalisées (ex. rugby : [2, 4] au lieu de [1, 2, 4, 6, 12, 24]). */
  hourOptions?: readonly number[];
  /** Masquer "Demain" (inutile pour le rugby week-end). */
  hideTomorrow?: boolean;
  /** Ajouter "Ce week-end" (rugby : samedi + dimanche). */
  showWeekend?: boolean;
};

/**
 * TimeRangeFilter — filtre par heure de début. Fenêtre glissante à partir de
 * maintenant (tolérance arrière 15 min, cf. `filterByStartWindow`).
 * « today » / « tomorrow » couvrent les jours calendaires Europe/Paris.
 */
export function TimeRangeFilter({ value, onChange, className, hourOptions, hideTomorrow, showWeekend }: Props) {
  const t = useTranslations("matchTabs");
  const hours = hourOptions ?? TIME_RANGE_OPTIONS;

  const options: Array<{ key: TimeFilterKey; label: string }> = [
    { key: "all", label: t("timeAll") },
    ...hours.map((h) => ({
      key: `${h}h` as TimeFilterKey,
      label: t("timeHour", { hours: h }),
    })),
    { key: "today", label: t("timeToday") },
    ...(hideTomorrow ? [] : [{ key: "tomorrow" as TimeFilterKey, label: t("timeTomorrow") }]),
    ...(showWeekend ? [{ key: "weekend" as TimeFilterKey, label: "Ce week-end" }] : []),
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
