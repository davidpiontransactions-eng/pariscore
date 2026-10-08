"use client";

// Rangée interne de sous-onglets tennis — PRÉSENTATION pure.
//
// ⚠️ SOURCE UNIQUE DE VÉRITÉ = `src/lib/tennis-sub-tab-ids.ts`. Ce fichier ne
// définit plus ni le type, ni la liste, ni le parseur : il ne porte que le
// libellé FR, l'icône et l indice d'état vide, indexés par id canonique.
// Avant, ce fichier réimplémentait son PROPRE jeu de 6 ids
// (`calendrier`/`live`/`top10`/`resultats`/`stats`/`backtesting`) pendant que
// `SPORT_SUB_TABS.tennis` et le module canonique en portaient 7 différents :
// deux vocabulaires concurrents, deux parsers du même nom, et un gating
// (`tennis-tab-content.tsx`) qui ne pouvait plus correspondre.

import {
  CalendarDays,
  Radio,
  Target,
  ListChecks,
  BarChart3,
  Swords,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TENNIS_SUB_TAB,
  TENNIS_SUB_TABS,
  isTennisSubTabId,
  parseTennisSubTab as parseCanonicalSubTab,
  type TennisSubTabId,
} from "@/lib/tennis-sub-tab-ids";

/** L'id canonique EST l'état du sous-onglet (plus de type local). */
export type TennisSubTab = TennisSubTabId;

// Ré-export : les consommateurs historiques (`tennis-tab-content.tsx`) et le
// store importent ces symboles d'ici.
export { DEFAULT_TENNIS_SUB_TAB, TENNIS_SUB_TABS };

type TabMeta = {
  id: TennisSubTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Description affichée dans l'état vide (panneau pas encore alimenté). */
  hint: string;
};

/** Métadonnées d'affichage, dans l'ordre de `TENNIS_SUB_TABS`. */
const TAB_META: Record<TennisSubTabId, Omit<TabMeta, "id">> = {
  prematch: {
    label: "Calendrier",
    icon: CalendarDays,
    hint: "Calendrier des matchs à venir : date, heure, recherche, filtre En direct et Top stratégies.",
  },
  live: {
    label: "Live",
    icon: Radio,
    hint: "Cartes live des matchs en cours : score set par set, MomentumDR, Live Matrix et cotes 1xBet.",
  },
  cards: {
    label: "Fiches Duels",
    icon: Swords,
    hint: "Fiches de confrontation directe (H2H) et comparaisons Elo / SPS / DR entre deux joueurs.",
  },
  tournaments: {
    label: "Tournois",
    icon: Trophy,
    hint: "Tableaux des tournois ATP/WTA et programme par court.",
  },
  list: {
    label: "Liste",
    icon: ListChecks,
    hint: "Vue liste synthétique de toutes les rencontres, sans fioriture visuelle.",
  },
  rankings: {
    label: "Statistiques",
    icon: BarChart3,
    hint: "Classements ATP/WTA, Elo mis à jour et statistiques par surface.",
  },
  strategies: {
    label: "TOP 10 Matchs",
    icon: Target,
    hint: "Les 10 meilleures opportunités par stratégie de pari, avec valeur et cote.",
  },
};

/** Libellé affiché d'un sous-onglet (partagé avec la rangée de tête). */
export function tennisSubTabLabel(id: TennisSubTabId): string {
  return TAB_META[id].label;
}

/** Normalise une valeur brute (store / URL) vers un sous-onglet valide. */
export function parseTennisSubTab(value: string | undefined): TennisSubTab {
  return parseCanonicalSubTab(value);
}

type Props = {
  activeSubTab: TennisSubTab;
  onSubTabChange: (tab: TennisSubTab) => void;
  className?: string;
};

/**
 * TennisSubTabs — rangée interne des 7 sous-onglets de l'onglet tennis.
 *
 * Pure / présentationnel : le parent lit et écrit la clé
 * `useSportsSidebarStore.sportSubTabs.tennis`, donc un clic ici ou dans la
 * rangée du header produit le même état.
 */
export function TennisSubTabs({ activeSubTab, onSubTabChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Sections de l'onglet tennis"
      className={cn(
        // `scrollbar-none` : le rail ne montre pas de barre de scroll, le geste
        // tactile reste. `shrink-0` sur chaque bouton évite l'écrasement des
        // libellés en viewport étroit (375-430 px).
        "flex w-full max-w-full gap-1 overflow-x-auto scrollbar-none scroll-snap-x rounded-lg border border-border/60 bg-muted/30 p-1",
        className,
      )}
    >
      {TENNIS_SUB_TABS.map((tab) => {
        const meta = TAB_META[tab.id];
        const isActive = activeSubTab === tab.id;
        const Icon = meta.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={meta.label}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "relative flex shrink-0 scroll-snap-start items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="whitespace-nowrap">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Panneau d'un sous-onglet tennis : porte le rôle `tabpanel` + son label.
 *
 * Sans `children` (ou avec `null`) il rend l'état vide — icône + descriptif —
 * même repli que `FootballSubTabPanel`.
 */
export function TennisSubTabPanel({
  sub,
  className,
  children,
}: {
  sub: TennisSubTab;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!isTennisSubTabId(sub)) return null;
  const meta = TAB_META[sub];
  const Icon = meta.icon;
  return (
    <div
      role="tabpanel"
      aria-label={meta.label}
      className={cn(
        "w-full max-w-full min-w-0",
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