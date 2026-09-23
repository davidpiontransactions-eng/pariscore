/**
 * Fenêtres de vue basket — séparation Live / Pre-match / Today.
 * Bug fixé (debug 2026-09-23) : filterByStartWindow inconditionnel drop tout
 * match démarré > 15 min → les live disparaissaient de toutes les vues.
 * Mirror du pattern football/tennis (filterLiveByWindow en vue live).
 */

import { filterByStartWindow, filterLiveByWindow, type MatchViewMode } from "./match-view";

type ViewItem = { status: string; scheduledAt: string };

const isLiveItem = <T extends ViewItem>(m: T): boolean => m.status === "in-progress";

/**
 * Filtre les matchs basket selon la vue active.
 * - live      → démarrés dans les 48h passées (jamais drop par tolérance avant-coup)
 * - prematch  → à venir dans les 48h (live exclus)
 * - today     → live conservés tels quels + prematch fenêtré
 */
export function selectBasketballView<T extends ViewItem>(
  items: T[],
  viewMode: MatchViewMode,
  now: Date = new Date(),
): T[] {
  const getAt = (m: T) => m.scheduledAt;
  if (viewMode === "live") {
    return filterLiveByWindow(items.filter(isLiveItem), 48, getAt, now);
  }
  if (viewMode === "prematch") {
    return filterByStartWindow(items.filter((m) => !isLiveItem(m)), 48, getAt, now);
  }
  const live = items.filter(isLiveItem);
  const pre = filterByStartWindow(items.filter((m) => !isLiveItem(m)), 48, getAt, now);
  return [...live, ...pre];
}
