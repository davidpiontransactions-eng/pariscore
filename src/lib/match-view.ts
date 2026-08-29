/**
 * Helpers purs de séparation Live / Pre-match et de filtre par heure de début.
 *
 * Ces fonctions sont volontairement indépendantes du type de match de chaque
 * sport : les tab-content passent leurs propres accesseurs (isLive /
 * getScheduledAt). Elles servent pour les onglets Live | Pre-match
 * (modèle 1xbet.com) présents dans tous les onglets sport.
 */

export type MatchViewMode = "live" | "prematch" | "today";

/** Valeurs de fenêtre horaire sérialisables (sidebar / URL). */
export type TimeFilterKey =
  | "all"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "24h"
  | "today"
  | "tomorrow";

/**
 * Filtres de stratégie unifiés (partagés entre football et tennis).
 * Affichés dans le dropdown du contenu central. Les filtres sport-spécifiques
 * sont en complément (over65corners pour football, etc.).
 */
export type StrategyFilter =
  | "all"
  | "value"
  | "confidence"
  | "favorites"
  | "corners"
  | "btts"
  | "today"
  | "topConf"
  | "over65corners"
  | "balanced"
  | "starred";

/** Labels d'affichage pour chaque filtre (i18n-friendly). */
export const STRATEGY_FILTER_LABELS: Record<StrategyFilter, string> = {
  all: "Tous",
  value: "Value Bets",
  confidence: "Confiance",
  favorites: "Favoris",
  corners: "Corners",
  btts: "Les deux marquent",
  today: "Aujourd'hui",
  topConf: "Haute confiance",
  over65corners: "Over 6.5 Corners",
  balanced: "Équilibrés",
  starred: "Favoris (étoilés)",
};

/** Filtres disponibles par sport. */
export const STRATEGY_FILTERS_BY_SPORT: Record<string, StrategyFilter[]> = {
  football: ["all", "today", "value", "topConf", "corners", "over65corners", "btts"],
  tennis: ["all", "favorites", "balanced", "starred", "confidence"],
};

/**
 * Décompose une clé de filtre temporel en fenêtre glissante (heures) et/ou
 * drapeaux « aujourd'hui » / « demain » (jours calendaires locaux).
 */
export function parseTimeFilter(key: TimeFilterKey): {
  hours: number | null;
  today: boolean;
  tomorrow: boolean;
} {
  if (key === "all") return { hours: null, today: false, tomorrow: false };
  if (key === "today") return { hours: null, today: true, tomorrow: false };
  if (key === "tomorrow") return { hours: null, today: false, tomorrow: true };
  const hours = Number.parseInt(key, 10);
  return { hours: Number.isFinite(hours) ? hours : null, today: false, tomorrow: false };
}

/**
 * Filtre les matchs dont le coup d'envoi tombe aujourd'hui (jour calendaire
 * local) — complément de `filterByStartWindow` pour la pill « Aujourd'hui ».
 */
export function filterByToday<T>(
  items: T[],
  getScheduledAt: (match: T) => string | null | undefined,
  now: Date = new Date(),
): T[] {
  const day = now.toDateString();
  return items.filter((match) => {
    const raw = getScheduledAt(match);
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && new Date(ts).toDateString() === day;
  });
}

/**
 * Filtre les matchs dont le coup d'envoi tombe DEMAIN (jour calendaire local).
 * Complément de `filterByToday` pour la pill « Demain ».
 */
export function filterByTomorrow<T>(
  items: T[],
  getScheduledAt: (match: T) => string | null | undefined,
  now: Date = new Date(),
): T[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = tomorrow.toDateString();
  return items.filter((match) => {
    const raw = getScheduledAt(match);
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && new Date(ts).toDateString() === day;
  });
}

/** Fenêtre horaire par défaut : 15 min de tolérance arrière. */
export const START_WINDOW_TOLERANCE_MIN = 15;

/** Options du filtre par heure de début (fenêtres glissantes, en heures). */
export const TIME_RANGE_OPTIONS = [1, 2, 4, 6, 12, 24] as const;

/**
 * Sépare une liste de matchs en { live, prematch } selon un prédicat de sport.
 */
export function splitLivePrematch<T>(
  items: T[],
  isLive: (match: T) => boolean,
): { live: T[]; prematch: T[] } {
  const live: T[] = [];
  const prematch: T[] = [];
  for (const match of items) {
    if (isLive(match)) live.push(match);
    else prematch.push(match);
  }
  return { live, prematch };
}

/**
 * Filtre des matchs « à venir » selon une fenêtre glissante à partir de
 * maintenant : coup d'envoi entre [now - tolérance, now + hours].
 *
 * - `hours === null` → aucun filtre (liste complète).
 * - `now` injectable pour les tests (défaut : Date.now()).
 * - Un match sans date (null/undefined) est exclu dès qu'un filtre est actif.
 * - La tolérance arrière (15 min) évite qu'un match qui vient de démarrer
 *   disparaisse brutalement de la liste pre-match.
 */
export function filterByStartWindow<T>(
  items: T[],
  hours: number | null,
  getScheduledAt: (match: T) => string | null | undefined,
  now: Date = new Date(),
  toleranceMin: number = START_WINDOW_TOLERANCE_MIN,
): T[] {
  if (hours === null) return items;
  const startMs = now.getTime() - toleranceMin * 60_000;
  const endMs = now.getTime() + hours * 3_600_000;
  return items.filter((match) => {
    const raw = getScheduledAt(match);
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts >= startMs && ts <= endMs;
  });
}

/**
 * Fenêtre glissante pour les matchs EN DIRECT : un live a déjà commencé, le
 * coup d'envoi est dans le passé — la fenêtre pertinente est
 * [now − hours, now] (« matchs dont le coup d'envoi a eu lieu dans les N
 * dernières heures »). `hours === null` → aucun filtre.
 */
export function filterLiveByWindow<T>(
  items: T[],
  hours: number | null,
  getScheduledAt: (match: T) => string | null | undefined,
  now: Date = new Date(),
): T[] {
  if (hours === null) return items;
  const startMs = now.getTime() - hours * 3_600_000;
  return items.filter((match) => {
    const raw = getScheduledAt(match);
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts >= startMs && ts <= now.getTime();
  });
}

/**
 * Ne garde que les matchs dont l'id est dans `ids` (sélection sidebar).
 * `ids` vide → liste inchangée (pas de filtre).
 */
export function filterBySelection<T>(
  items: T[],
  ids: string[],
  getId: (match: T) => string | number,
): T[] {
  if (ids.length === 0) return items;
  const set = new Set(ids);
  return items.filter((match) => set.has(String(getId(match))));
}