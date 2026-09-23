/**
 * Moteur Elo Rating pour joueurs snooker
 *
 * Basé sur:
 * - Collingwood, Wright & Brooks (EJOR 2021): K-factor adaptatif
 * - Elo original (Arpad Elo): distribution logistique
 * - K-factor calibré: 32 pour top players, 40 pour mid-tier, 50 pour lower-ranked
 *
 * Le système calcule les ratings à partir de l'historique des matchs
 * et fournit des probabilités de gain frame basées sur l'écart de rating.
 */

// ── Constantes Elo ──────────────────────────────────────────────────

/** Rating initial pour tous les joueurs */
const INITIAL_RATING = 1500;

/** Diviseur de déviation standard (Collingwood: 500) */
const STD_DEV = 400;

// ── Fonctions utilitaires ───────────────────────────────────────────

/**
 * Probabilité attendue de gain selon la différence de rating
 * Formule logistique standard: P = 1 / (1 + 10^((Rb-Ra)/400))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / STD_DEV));
}

/**
 * Raccourci: calcule un rating simplifié à partir des stats CueTracker
 * (sans l'historique complet des matchs)
 */
export function quickElo(wins: number, losses: number, _centuries: number = 0): number {
  const played = wins + losses;
  if (played === 0) return INITIAL_RATING;

  // Shrinkage Laplace : prior 50 % sur N=30 — petit échantillon → ≈1500
  // (sans ça : 1 victoire/0 défaite → Elo 2000 affiché comme réel).
  // Bonus centuries retiré (_centuries ignoré) : biaise les top players (audit lot3).
  const shrunk = (wins + 15) / (played + 30);
  const base = 1500 + (shrunk - 0.5) * 1000;
  return Math.round(Math.max(800, Math.min(2200, base)));
}
