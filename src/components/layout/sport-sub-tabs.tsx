"use client";

import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { cn } from "@/lib/utils";

/* ─── Charte headbar Flashscore (tokens relevés dans sport-tabs.tsx) ─── */
const FS_BG = "#eeeeee";
const FS_BORDER = "#c8cdcd";
const FS_ACTIVE = "#e80040";

export type SportSubTab = { id: string; label: string };

/**
 * Sous-onglets niveau 2.5 par sport (ex. rangée sous le bouton Basketball).
 * Sport absent de la config → aucune rangée rendue (header inchangé ailleurs).
 */
export const SPORT_SUB_TABS: Record<string, SportSubTab[]> = {
  basketball: [
    { id: "matchs", label: "Matchs" },
    { id: "calendrier", label: "Calendrier" },
    { id: "stats", label: "Stats & Classements" },
    { id: "h2h", label: "H2H" },
    { id: "fiba", label: "FIBA WC" },
  ],
};

/**
 * SportSubTabs — rangée (~36px) sous SportTabs, scroll-x mobile.
 * Lit/écrit useSportsSidebarStore.sportSubTabs (persisté) : le contenu d'onglet
 * (ex. basketball-tab-content) lit la même clé → toggle interne et headbar
 * restent synchronisés.
 */
export function SportSubTabs({ className }: { className?: string }) {
  const activeSport = useSportsSidebarStore((s) => s.selectedSportId ?? "football");
  const subTab = useSportsSidebarStore((s) => s.sportSubTabs[activeSport]);
  const setSubTab = useSportsSidebarStore((s) => s.setSubTab);

  const tabs = SPORT_SUB_TABS[activeSport];
  if (!tabs || tabs.length === 0) return null;

  const active = subTab ?? tabs[0].id;

  return (
    <div
      role="tablist"
      aria-label={`Sous-sections ${activeSport}`}
      className={cn("w-full", className)}
      style={{ backgroundColor: FS_BG, borderBottom: `1px solid ${FS_BORDER}` }}
    >
      <div className="mx-auto flex h-9 max-w-7xl items-stretch gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSubTab(activeSport, t.id)}
              className={cn(
                "relative shrink-0 px-3 text-xs font-semibold uppercase tracking-wide transition-colors",
                isActive ? "text-[#e80040]" : "text-[#555e61] hover:text-[#001e28]",
              )}
            >
              {t.label}
              {isActive && (
                <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-sm" style={{ backgroundColor: FS_ACTIVE }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
