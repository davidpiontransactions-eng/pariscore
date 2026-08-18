/**
 * Helpers purs de séparation Live / Pre-match et de filtre par heure de début.
 *
 * Ces fonctions sont volontairement indépendantes du type de match de chaque
 * sport : les tab-content passent leurs propres accesseurs (isLive /
 * getScheduledAt). Elles servent pour les onglets Live | Pre-match
 * (modèle 1xbet.com) présents dans tous les onglets sport.
 */

export type MatchViewMode = "live" | "prematch";

/** Valeurs de fenêtre horaire sérialisables (sidebar / URL). */
export type TimeFilterKey =
  | "all"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "24h"
  | "today";

/**
 * Décompose une clé de filtre temporel en fenêtre glissante (heures) et/ou
 * drapeau « aujourd'hui » (jour calendaire local).
 */
export function parseTimeFilter(key: TimeFilterKey): {
  hours: number | null;
  today: boolean;
} {
  if (key === "all") return { hours: null, today: false };
  if (key === "today") return { hours: null, today: true };
  const hours = Number.parseInt(key, 10);
  return { hours: Number.isFinite(hours) ? hours : null, today: false };
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