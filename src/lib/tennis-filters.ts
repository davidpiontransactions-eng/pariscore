/**
 * Filtres partagés pour le widget Top 10 tennis — tournament + time window.
 * Réplique la logique du widget football (football-top10-widget.tsx).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type TennisTimeWindow = "all" | "jour" | "48h" | "semaine";

export const TENNIS_TIME_WINDOWS: readonly { key: TennisTimeWindow; label: string; title: string }[] = [
  { key: "all", label: "Tout", title: "Tous les matchs" },
  { key: "jour", label: "Jour", title: "Matchs du jour" },
  { key: "48h", label: "48h", title: "Matchs sous 48 heures" },
  { key: "semaine", label: "Sem.", title: "Matchs de la semaine" },
] as const;

// ─── Extract tournaments ───────────────────────────────────────────────────

/** Extrait la liste triée des tournois uniques depuis les matchs. */
export function extractTournaments(
  matches: { tournament: string }[],
): string[] {
  const set = new Set(matches.map((m) => m.tournament));
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ─── Filter by tournament ──────────────────────────────────────────────────

/** Filtre les matchs par tournoi exact. null = tous les tournois. */
export function filterByTournament<T extends { tournament: string }>(
  matches: T[],
  tournament: string | null,
): T[] {
  if (!tournament) return matches;
  return matches.filter((m) => m.tournament === tournament);
}

// ─── Filter by time window ─────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Filtre les matchs par fenêtre temporelle. */
export function filterByTimeWindow<T extends { scheduledAt: string }>(
  matches: T[],
  window: TennisTimeWindow,
): T[] {
  if (window === "all") return matches;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const t0 = startOfDay.getTime();
  let end: number;
  switch (window) {
    case "jour":
      end = t0 + DAY_MS;
      break;
    case "48h":
      end = t0 + 2 * DAY_MS;
      break;
    case "semaine":
      end = t0 + 7 * DAY_MS;
      break;
    default:
      return matches;
  }
  return matches.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return Number.isFinite(t) && t >= t0 && t < end;
  });
}
