/**
 * Types du score L10 Surface (spec ParisScore).
 *
 * L10 Surface : score d'activité récente sur une surface donnée, calculé sur
 * les 10 derniers matchs terminés (même surface, fenêtre 3 mois), avec l'Elo
 * FIGÉ à la semaine ISO de chaque match (snapshots TennisAbstract hebdomadaires).
 */

/**
 * Catégorie de performance L10 (bornes définies par la spec) :
 *   - "under"    : score < 10  → moins d'1 point/match : défaites répétées
 *                  ou victoires de routine contre des adversaires nettement
 *                  inférieurs (pas de surperformance récente sur la surface).
 *   - "average"  : 10 ≤ score < 25 → routine à bon : victoires contre des
 *                  adversaires de niveau égal ou légèrement supérieur.
 *   - "over"     : score ≥ 25 → victoires répétées contre des adversaires
 *                  supérieurs (≥ 2,5 pts/match) = surperformance réelle.
 */
export type L10Performance = "under" | "average" | "over";

export const L10_PERF_AVERAGE_MIN = 10;
export const L10_PERF_OVER_MIN = 25;

export function l10PerformanceOf(score: number): L10Performance {
  if (score < L10_PERF_AVERAGE_MIN) return "under";
  if (score < L10_PERF_OVER_MIN) return "average";
  return "over";
}

export type L10SurfaceMatch = {
  date: Date; // date du match
  weekIso: string; // semaine ISO du match (ex: "2026-W33")
  surface: string; // "Hard" | "Clay" | "Grass"
  tournament: string;
  round: string;
  opponentName: string;
  opponentKey: string; // clé normalisée tennisabstract
  result: "W" | "L";
  score: string; // ex: "6-1 6-3"
  playerEloAtWeek: number | null; // Elo figé du joueur à la semaine du match
  opponentEloAtWeek: number | null; // Elo figé de l'adversaire à la semaine du match
  eloDiff: number | null; // EloAdversaire − EloJoueur (figés, arrondi)
  points: number; // points attribués (victoire selon ΔElo, défaite = 0)
  rated: boolean; // true si les deux Elo figés étaient disponibles
};

export type L10SurfaceScoreResult = {
  playerKey: string;
  surface: string; // "Hard" | "Clay" | "Grass"
  score: number; // somme des points sur la fenêtre
  wins: number;
  losses: number;
  matches: number; // nombre de matchs analysés (≤ 10)
  rated: number; // nombre de matchs avec les deux Elo figés disponibles
  details: L10SurfaceMatch[];
  /** Catégorie de performance dérivée du score (bornes spec). */
  performance: L10Performance;
  computedAt: string; // ISO
  windowDays: number; // fenêtre (93)
  maxMatches: number; // 10
};
