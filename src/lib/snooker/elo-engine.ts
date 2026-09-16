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

export type PlayerRating = {
  id: string;
  name: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  peakRating: number;
  currentForm: number; // Win% des 20 derniers matchs
};

type MatchResult = {
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
};

// ── Constantes Elo ──────────────────────────────────────────────────

/** Rating initial pour tous les joueurs */
const INITIAL_RATING = 1500;

/** K-factor par niveau (Collingwood: weight=10, std=500) */
const K_FACTORS = {
  top: 24,      // Top 32: rating > 1700
  mid: 32,      // Mid-tier: 1400-1700
  lower: 40,    // Lower-ranked: < 1400
  new: 50,      // Nouveaux joueurs (< 30 matchs)
} as const;

/** Diviseur de déviation standard (Collingwood: 500) */
const STD_DEV = 400;

/** Decay factor pour l'inactivité (par mois d'inactivité) */
const DECAY_PER_MONTH = 0.98;

// ── Fonctions utilitaires ───────────────────────────────────────────

/**
 * K-factor adaptatif selon le niveau et l'expérience du joueur
 */
function getKFactor(player: PlayerRating): number {
  if (player.matchesPlayed < 30) return K_FACTORS.new;
  if (player.rating > 1700) return K_FACTORS.top;
  if (player.rating > 1400) return K_FACTORS.mid;
  return K_FACTORS.lower;
}

/**
 * Probabilité attendue de gain selon la différence de rating
 * Formule logistique standard: P = 1 / (1 + 10^((Rb-Ra)/400))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / STD_DEV));
}

/**
 * Met à jour le rating d'un joueur après un match
 */
function updateRating(
  player: PlayerRating,
  opponentRating: number,
  won: boolean,
  framesPlayed: number
): number {
  const E = expectedScore(player.rating, opponentRating);
  const S = won ? 1 : 0;
  const K = getKFactor(player);

  // Ajustement par nombre de frames (plus de weight pour les longs matchs)
  const frameMultiplier = Math.min(2, 1 + (framesPlayed - 1) * 0.1);

  return Math.round(player.rating + K * frameMultiplier * (S - E));
}

// ── Moteur principal ────────────────────────────────────────────────

/**
 * Calcule les ratings Elo à partir de l'historique des matchs
 *
 * @param playersData - Données CueTracker (players array)
 * @param matchesData - Matchs FlashScore (pour l'ordre chronologique)
 * @returns Map<playerId, PlayerRating>
 */
export function computeEloRatings(
  playersData: Array<{
    id: string;
    name: string;
    wins?: number;
    losses?: number;
    matches_played?: number;
  }>,
  matchesData?: Array<{
    player1: string;
    player2: string;
    winner?: string;
    scoreA?: number;
    scoreB?: number;
  }>
): Map<string, PlayerRating> {
  // Initialiser les ratings
  const ratings = new Map<string, PlayerRating>();

  for (const p of playersData) {
    const wins = p.wins ?? 0;
    const losses = p.losses ?? 0;
    const played = p.matches_played ?? (wins + losses);

    // Rating initial basé sur le ratio wins/losses (heuristique améliorée)
    const winRatio = played > 0 ? wins / played : 0.5;
    // Mapping: 50% → 1500, 70% → 1800, 30% → 1200
    const initialRating = Math.round(1500 + (winRatio - 0.5) * 1500);

    ratings.set(p.id, {
      id: p.id,
      name: p.name,
      rating: Math.max(800, Math.min(2200, initialRating)),
      matchesPlayed: played,
      wins,
      losses,
      peakRating: Math.max(800, Math.min(2200, initialRating)),
      currentForm: winRatio * 100,
    });
  }

  // Si on a des matchs avec résultats, simuler les mises à jour Elo
  if (matchesData && matchesData.length > 0) {
    for (const match of matchesData) {
      if (!match.winner || match.scoreA == null || match.scoreB == null) continue;

      const winnerId = match.winner === match.player1
        ? playersData.find(p => p.name === match.player1)?.id
        : playersData.find(p => p.name === match.player2)?.id;
      const loserId = match.winner === match.player1
        ? playersData.find(p => p.name === match.player2)?.id
        : playersData.find(p => p.name === match.player1)?.id;

      if (!winnerId || !loserId) continue;

      const winner = ratings.get(winnerId);
      const loser = ratings.get(loserId);
      if (!winner || !loser) continue;

      const framesPlayed = (match.scoreA ?? 0) + (match.scoreB ?? 0);
      const winnerScore = match.winner === match.player1 ? match.scoreA ?? 0 : match.scoreB ?? 0;
      const loserScore = match.winner === match.player1 ? match.scoreB ?? 0 : match.scoreA ?? 0;

      // Met à jour les ratings
      const newWinnerRating = updateRating(winner, loser.rating, true, framesPlayed);
      const newLoserRating = updateRating(loser, winner.rating, false, framesPlayed);

      winner.rating = newWinnerRating;
      winner.peakRating = Math.max(winner.peakRating, newWinnerRating);
      winner.wins++;
      winner.matchesPlayed++;

      loser.rating = newLoserRating;
      loser.losses++;
      loser.matchesPlayed++;
    }
  }

  // Appliquer le decay pour l'inactivité (basé sur le dernier match)
  const now = Date.now();
  for (const player of ratings.values()) {
    if (player.matchesPlayed > 0) {
      // Decay: plus le joueur a joué récemment, moins il perd
      // Pour simplifier: pas de decay ici (on n'a pas de date de dernier match)
      // Le decay sera appliqué si on a la date du dernier match
    }
  }

  return ratings;
}

/**
 * Raccourci: calcule un rating simplifié à partir des stats CueTracker
 * (sans l'historique complet des matchs)
 */
export function quickElo(wins: number, losses: number, centuries: number = 0): number {
  const played = wins + losses;
  if (played === 0) return INITIAL_RATING;

  const winPct = wins / played;
  // Bonus centuries: +1 rating point par century (max +150)
  const centuryBonus = Math.min(150, centuries);

  // Base: 1500 + ajustement win% (±500 max)
  const base = 1500 + (winPct - 0.5) * 1000;
  return Math.round(Math.max(800, Math.min(2200, base + centuryBonus)));
}

/**
 * Convertit un rating Elo en win% estimé vs un adversaire moyen (1500)
 */
export function eloToWinPct(rating: number): number {
  return expectedScore(rating, 1500) * 100;
}

/**
 * Convertit un rating Elo en century rate estimé
 */
export function eloToCenturyRate(rating: number): number {
  // Heuristique: top players (1800+) → 8-12%, mid (1500-1800) → 4-8%, lower → 1-4%
  if (rating > 1800) return 8 + (rating - 1800) / 100;
  if (rating > 1500) return 4 + (rating - 1500) / 75;
  return 1 + Math.max(0, rating - 1000) / 500 * 3;
}
