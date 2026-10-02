"use client";

import { CalendarDays, Target, FlaskConical, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export type FootballSubTab = "calendrier" | "top-strategies" | "backtesting" | "results";

type TabMeta = {
  id: FootballSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Description affichée dans l'état vide (ouverture avant la vague suivante). */
  hint: string;
};

/**
 * Définitions des 4 sous-onglets football : libellés + icônes + texte de repli.
 *
 * ⚠️ Les `id` doivent rester synchronisés avec `SPORT_SUB_TABS.football`
 * (`src/components/layout/sport-sub-tabs.tsx`) — la rangée Flashscore du header
 * porte les mêmes identifiants, c'est ce qui garde les deux rangées alignées
 * (même clé `sportSubTabs.football` dans le store). Même pattern que basketball.
 */
export const FOOTBALL_SUB_TABS: TabMeta[] = [
  {
    id: "calendrier",
    label: "Calendrier",
    icon: CalendarDays,
    hint: "Calendrier des matchs du jour, filtrable par heure, ligue et équipes suivies.",
  },
  {
    id: "top-strategies",
    label: "Top stratégies",
    icon: Target,
    hint: "Top 10 des matchs par stratégie de pari, avec valeur et cote.",
  },
  {
    id: "backtesting",
    label: "Back Testing",
    icon: FlaskConical,
    hint: "Rejeu historique des marchés : ROI, taux de réussite et drawdown par marché.",
  },
  {
    id: "results",
    label: "Résultats",
    icon: ListChecks,
    hint: "Résultats des matchs terminés sur les 7 derniers jours, avec verdict des stratégies.",
  },
];

export const DEFAULT_FOOTBALL_SUB_TAB: FootballSubTab = "calendrier";

/** Normalise une valeur brute (store / URL) vers un sous-onglet valide. */
export function parseFootballSubTab(value: string | undefined): FootballSubTab {
  return FOOTBALL_SUB_TABS.some((t) => t.id === value)
    ? (value as FootballSubTab)
    : DEFAULT_FOOTBALL_SUB_TAB;
}

type Props = {
  activeSubTab: FootballSubTab;
  onSubTabChange: (tab: FootballSubTab) => void;
  className?: string;
};

/**
 * FootballSubTabs — rangée interne des 4 sous-onglets de l'onglet football
 * (Calendrier / Top stratégies / Back Testing / Résultats).
 *
 * Doublon volontaire de la rangée Flashscore `SportSubTabs` du header :
 * les deux lisent/écrivent la MÊME clé `sportSubTabs.football` du store, donc
 * un clic dans l'une met l'autre à jour (et inversement). La répétition
 * sert au scroll long — cf. décision d'architecture "header + commande interne".
 *
 * Style compact shadcn-like, cohérent avec `TennisSubTabs`
 * (`src/components/tennis/tennis-sub-tabs.tsx`).
 *
 * Pure / présentationnel — pas de state, le parent gère `activeSubTab`.
 */
export function FootballSubTabs({ activeSubTab, onSubTabChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Sections de l'onglet football"
      className={cn(
        "flex w-full gap-1 overflow-x-auto scroll-snap-x rounded-lg border border-border/60 bg-muted/30 p-1",
        className,
      )}
    >
      {FOOTBALL_SUB_TABS.map((tab) => {
        const isActive = activeSubTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Panneau d'un sous-onglet football : porte le rôle `tabpanel` + son label.
 *
 * Sans `children` (ou avec `null`) il rend l'état vide — icône + descriptif —
 * c'est le repli d'une vue pas encore câblée ou d'une vue sans données.
 * Avec un contenu, il rend ce contenu et garde le rôle/label pour rester
 * appairé au bouton du `tablist`.
 */
export function FootballSubTabPanel({
  sub,
  className,
  children,
}: {
  sub: FootballSubTab;
  className?: string;
  children?: React.ReactNode;
}) {
  const meta = FOOTBALL_SUB_TABS.find((t) => t.id === sub);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div
      role="tabpanel"
      aria-label={meta.label}
      className={cn(
        children == null &&
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 px-6 py-14 text-center",
        className,
      )}
    >
      {children ?? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="max-w-md text-xs text-muted-foreground">{meta.hint}</p>
        </>
      )}
    </div>
  );
}
