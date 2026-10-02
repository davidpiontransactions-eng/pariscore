"use client";

import { useEffect } from "react";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

/**
 * Arme `selectedSportId` au montage d'une page sport dédiée (/snooker,
 * /rugby, …).
 *
 * Pourquoi : `SiteHeader` (onglets sport) et `SportSubTabs` (rangée du niveau 2.5)
 * lisent tous deux `selectedSportId` et **sortent tôt** quand il est vide
 * (`sport-sub-tabs.tsx:61`). Sur une route sport dédiée, rien ne le positionne :
 * l'onglet du header reste donc sur la valeur par défaut (« football ») et la
 * rangée de sous-onglets ne s'affiche pas du tout — donc les vues Résultats et
 * Backtesting, qui portent les seuls tableaux de la page, sont inaccessibles.
 *
 * Le store est piloté par l'utilisateur via les onglets du header : on ne fait
 * qu'annoncer le sport de la route. Le setter n'est appelé que si la valeur
 * diffère, pour pas écraser un choix fait dans une autre session onglet.
 *
 * Montage uniquement : revenir à la racine est fait par les onglets eux-mêmes
 * (`syncSportFromTab`), pas par ce composant.
 */
export function SportPageSync({ sport }: { sport: string }) {
  useEffect(() => {
    if (useSportsSidebarStore.getState().selectedSportId !== sport) {
      useSportsSidebarStore.getState().syncSportFromTab(sport);
    }
  }, [sport]);

  return null;
}