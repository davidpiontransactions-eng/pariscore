/**
 * Tennis score formatting helpers — shared across live score components.
 *
 * Centralised so the score logic is defined once instead of being duplicated
 * between `match-card.tsx` (LiveScoreBar) and the new header score components
 * (`SetScoreline`, `CurrentGameScore`).
 */

/** Internal point index (0/1/2/3/4+) → tennis point notation. */
const POINT_LABELS = ["0", "15", "30", "40"] as const;

/** Map a raw point count to its tennis label (0→"0", 1→"15", 2→"30", 3+→"40"). */
function pointLabel(p: number): string {
  return POINT_LABELS[p] ?? "40";
}

/**
 * Format the current game score from raw point counts (0/1/2/3+ each side).
 *
 * Handles deuce (40-40) and advantage (Av.-40 / 40-Av.) when both players have
 * reached 3 points or more — the tennis scoring quirk that doubles the count
 * instead of capping at 40.
 *
 * @example formatPoints(2, 1) === "30-15"
 *          formatPoints(3, 3) === "40-40"  // deuce
 *          formatPoints(4, 3) === "Av.-40" // advantage server/side A
 *          formatPoints(3, 4) === "40-Av."
 */
export function formatPoints(pA: number, pB: number): string {
  if (pA >= 3 && pB >= 3) {
    if (pA === pB) return "40-40"; // deuce
    return pA > pB ? "Av.-40" : "40-Av.";
  }
  return `${pointLabel(pA)}-${pointLabel(pB)}`;
}

/**
 * Build a human-readable set-by-set scoreline string (no formatting).
 *
 * Past sets come from `scoreA.sets` / `scoreB.sets`, the current set's game
 * score from `scoreA.games` / `scoreB.games`.
 *
 * @example sets=[6,6], games=3 (A) vs sets=[4,3], games=2 (B)
 *          → "6-4 6-3 3-2"
 *
 * The current (in-progress) set is appended only when at least one game has
 * been played, so a fresh set starting at 0-0 doesn't append noise.
 */
export function formatScoreline(
  scoreA: { sets: number[]; games: number },
  scoreB: { sets: number[]; games: number },
): string {
  const pastSets = scoreA.sets
    .map((gA, i) => `${gA}-${scoreB.sets[i] ?? 0}`)
    .join(" ");

  const hasCurrentGames = scoreA.games > 0 || scoreB.games > 0;
  const currentGames = hasCurrentGames
    ? `${scoreA.games}-${scoreB.games}`
    : "";

  return [pastSets, currentGames].filter(Boolean).join(" ");
}
