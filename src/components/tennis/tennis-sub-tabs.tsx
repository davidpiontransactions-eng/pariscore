"use client";

import { Radio, Calendar, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type TennisSubTab = "live" | "today" | "tournaments";

type Props = {
  activeSubTab: TennisSubTab;
  onSubTabChange: (tab: TennisSubTab) => void;
  liveCount: number;
  todayCount: number;
  className?: string;
};

/**
 * TennisSubTabs — 3 sous-onglets de l'onglet tennis :
 *   🟢 Live (matchs en direct)
 *   📅 Aujourd'hui (tous les matchs du jour, prematch + live)
 *   🏆 Tournois (grille ATP/WTA/ITF)
 *
 * Style compact shadcn-like avec badges de compte animés. Icônes lucide.
 * Cohérent avec SportTabs (`src/components/layout/sport-tabs.tsx`) mais
 * taille plus petite (sous-onglet, pas onglet principal).
 *
 * Pure / présentationnel — pas de state, le parent gère `activeSubTab`.
 */
export function TennisSubTabs({
  activeSubTab,
  onSubTabChange,
  liveCount,
  todayCount,
  className,
}: Props) {
  const t = useTranslations("tennis");

  const tabs: Array<{
    id: TennisSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    accent: string;
    ariaLabel: string;
  }> = [
    {
      id: "live",
      label: t("subTabLive"),
      icon: Radio,
      count: liveCount,
      accent: "bg-emerald-500",
      ariaLabel: t("subTabLiveAria", { n: liveCount }),
    },
    {
      id: "today",
      label: t("subTabToday"),
      icon: Calendar,
      count: todayCount,
      accent: "bg-sky-500",
      ariaLabel: t("subTabTodayAria", { n: todayCount }),
    },
    {
      id: "tournaments",
      label: t("subTabTournaments"),
      icon: Trophy,
      count: 0,
      accent: "bg-amber-500",
      ariaLabel: t("subTabTournamentsAria"),
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t("subTabsAriaLabel")}
      className={cn(
        "flex w-full gap-1 rounded-lg border border-border/60 bg-muted/30 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeSubTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.ariaLabel}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                aria-hidden
                className={cn(
                  "ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold tabular-nums",
                  isActive
                    ? `${tab.accent} text-white`
                    : "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
