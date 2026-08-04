import type { FootballMatch } from "@/lib/football-data";

/**
 * Estime l'écart Elo football depuis les probabilités du modèle (inversion Elo).
 * Formule : ΔElo ≈ -400 × log₁₀(100/favProb - 1)
 * Retourne 0 si les équipes sont équilibrées (favProb ≤ 50) ou si la proba est invalide.
 */
export function estimateFootballEloGap(match: FootballMatch): number {
  const { homeProb, awayProb } = match.prediction;
  const favProb = Math.max(homeProb, awayProb);
  if (favProb <= 50) return 0;
  if (favProb >= 100) return 0;
  return Math.round(-400 * Math.log10(100 / favProb - 1));
}
