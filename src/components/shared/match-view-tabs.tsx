"use client";

import { useCallback, useId, useRef } from "react";
import { Radio, CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MatchViewMode } from "@/lib/match-view";

type Props = {
  active: MatchViewMode;
  onChange: (mode: MatchViewMode) => void;
  liveCount: number;
  prematchCount: number;
  /**
   * Base d'id partagée avec les tabpanels du parent : le panel du mode X
   * doit porter l'id `${idBase}-panel-${X}` (lien aria-controls).
   */
  idBase?: string;
  className?: string;
};

/**
 * MatchViewTabs — sous-onglets génériques Live | Pre-match (modèle 1xbet.com).
 *
 * Présentiel : le parent fournit `active` + les compteurs, et filtre ses
 * listes selon le mode actif. Utilisé par tous les onglets sport avec liste
 * de matchs (football, NBA, WNBA, CS2, MMA, baseball, rugby).
 *
 * Accessibilité : tablist conforme WAI-ARIA (roles tab/tablist,
 * aria-selected, tabindex itinérant, navigation clavier fléchée + Home/End,
 * activation au focus). Responsive : débordement horizontal scrollable sur
 * petit écran. Style : cohérent avec TennisSubTabs et SportTabs.
 */
export function MatchViewTabs({
  active,
  onChange,
  liveCount,
  prematchCount,
  idBase,
  className,
}: Props) {
  const t = useTranslations("matchTabs");
  const liveRef = useRef<HTMLButtonElement>(null);
  const prematchRef = useRef<HTMLButtonElement>(null);
  const fallbackId = useId();
  const tabIdBase = idBase ?? fallbackId;

  const tabs: Array<{
    id: MatchViewMode;
    label: string;
    aria: string;
    count: number;
    ref: React.RefObject<HTMLButtonElement | null>;
    icon: typeof Radio;
    activeCls: string;
  }> = [
    {
      id: "live",
      label: t("live"),
      aria: t("liveAria", { n: liveCount }),
      count: liveCount,
      ref: liveRef,
      icon: Radio,
      activeCls: "bg-emerald-500",
    },
    {
      id: "prematch",
      label: t("prematch"),
      aria: t("prematchAria", { n: prematchCount }),
      count: prematchCount,
      ref: prematchRef,
      icon: CalendarClock,
      activeCls: "bg-sky-500",
    },
  ];

  const activate = useCallback(
    (id: MatchViewMode) => {
      if (id !== active) onChange(id);
    },
    [active, onChange],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const current = active === "live" ? "live" : "prematch";
    let next: MatchViewMode;
    if (event.key === "Home") next = "live";
    else if (event.key === "End") next = "prematch";
    else next = current === "live" ? "prematch" : "live";
    activate(next);
    (next === "live" ? liveRef : prematchRef).current?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("tabsAriaLabel")}
      onKeyDown={onKeyDown}
      className={cn(
        "flex w-full gap-1 overflow-x-auto scroll-snap-x rounded-lg border border-border/60 bg-muted/30 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`${tabIdBase}-${tab.id}`}
            ref={tab.ref}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={tab.aria}
            aria-controls={`${tabIdBase}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => activate(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span>{tab.label}</span>
            {/* Compteur de matchs — toujours affiché (Live (12) / Pre-match (45)) */}
            <span
              aria-hidden
              className={cn(
                "ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold tabular-nums",
                tab.count > 0
                  ? isActive
                    ? `${tab.activeCls} text-white`
                    : "bg-muted-foreground/30 text-muted-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground/70",
              )}
            >
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}