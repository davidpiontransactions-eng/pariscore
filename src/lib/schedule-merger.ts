/**
 * Fusionne les schedules TennisTemple (vraies heures + timezone) avec les
 * matchs BSD (source principale). Chaque match BSD est enrichi si on trouve
 * un match TennisTemple avec les mêmes noms de joueurs.
 *
 * Stratégie de matching : `normForLookup()` (NFD → strip diacritics →
 * lowercase) sur les noms, puis recherche du schedule TT correspondant.
 * On gère l'ordre P1/P2 (TT peut avoir A/B inversé vs BSD).
 */

import { ParsedScheduleEntry } from "./tennistemple-parser";

export type BSDScheduleMatch = {
  id: string;
  playerA: { name: string };
  playerB: { name: string };
  scheduledAt: string;
  tournament?: string;
};

export type MergedSchedule = BSDScheduleMatch & {
  /** Override avec TennisTemple si match trouvé, sinon scheduledAt BSD */
  scheduledAt: string;
  /** Timezone IANA du tournoi (depuis TT), undefined si BSD seul */
  timezone?: string;
  /** Heure locale au tournoi (depuis TT) */
  localTime?: string;
  scheduleSource: "tennistemple" | "bsd" | "fallback";
};

/**
 * Normalisation de nom (NFD → strip diacritics → lowercase → trim espaces).
 * Réutilise le même pattern que `match-card.tsx:normForLookup` et
 * `player-matcher.ts`.
 */
function normForLookup(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Construit un index des schedules TT par nom de joueur pour lookup O(1).
 * Une entrée peut matcher par P1 OU P2 → on indexe les deux.
 */
function indexScheduleByPlayer(
  ttSchedule: ParsedScheduleEntry[],
): Map<string, ParsedScheduleEntry> {
  const map = new Map<string, ParsedScheduleEntry>();
  for (const entry of ttSchedule) {
    const p1 = normForLookup(entry.player1Name);
    const p2 = normForLookup(entry.player2Name);
    // Indexer par token unique : on garde le match P1+P2 (ordre canonique)
    const key = [p1, p2].sort().join("|");
    if (!map.has(key)) map.set(key, entry);
  }
  return map;
}

/**
 * Fusionne schedules TT + matchs BSD.
 *
 * @param bsdMatches Matchs BSD (source principale, déjà fetchés)
 * @param ttSchedule Schedules TT scrapés (peut être vide si TT indispo)
 * @returns Matchs BSD enrichis avec vraie heure + timezone si dispo
 */
export function mergeSchedules(
  bsdMatches: BSDScheduleMatch[],
  ttSchedule: ParsedScheduleEntry[],
): MergedSchedule[] {
  if (!ttSchedule.length) {
    // Pas de données TT → retour BSD tel quel, marqué "bsd" ou "fallback"
    return bsdMatches.map((m) => {
      // Détecter fallback : scheduledAt === maintenant ± 5min → trompeur
      const scheduledTime = Date.parse(m.scheduledAt);
      const now = Date.now();
      const isFallback =
        Number.isFinite(scheduledTime) &&
        Math.abs(scheduledTime - now) < 5 * 60_000;
      return {
        ...m,
        scheduleSource: isFallback ? "fallback" : "bsd",
      };
    });
  }

  const ttIndex = indexScheduleByPlayer(ttSchedule);

  return bsdMatches.map((m) => {
    const pA = normForLookup(m.playerA.name);
    const pB = normForLookup(m.playerB.name);
    const key = [pA, pB].sort().join("|");
    const ttEntry = ttIndex.get(key);

    if (ttEntry) {
      return {
        ...m,
        scheduledAt: ttEntry.scheduledAtUTC,
        timezone: ttEntry.timezone,
        localTime: ttEntry.localTime,
        scheduleSource: "tennistemple",
      };
    }

    // Pas de match TT → garder BSD, vérifier fallback
    const scheduledTime = Date.parse(m.scheduledAt);
    const now = Date.now();
    const isFallback =
      Number.isFinite(scheduledTime) &&
      Math.abs(scheduledTime - now) < 5 * 60_000;
    return {
      ...m,
      scheduleSource: isFallback ? "fallback" : "bsd",
    };
  });
}

/**
 * Helper : regroupe les matchs BSD par scheduleSource pour monitoring.
 */
export function summarizeScheduleSources(
  merged: MergedSchedule[],
): { tennistemple: number; bsd: number; fallback: number; total: number } {
  return merged.reduce(
    (acc, m) => {
      acc[m.scheduleSource] = (acc[m.scheduleSource] ?? 0) + 1;
      acc.total += 1;
      return acc;
    },
    { tennistemple: 0, bsd: 0, fallback: 0, total: 0 } as Record<string, number>,
  ) as { tennistemple: number; bsd: number; fallback: number; total: number };
}
