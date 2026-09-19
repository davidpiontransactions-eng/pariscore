/**
 * Registry marché → modèle — mapping type-safe des 45+ marchés tennis 1xBet.
 *
 * Chaque marché pointe vers la fonction de calcul appropriée.
 * Source de vérité pour l'API et l'UI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Catégorie de marché. */
export type MarketCategory =
  | "match-winner"
  | "set-score"
  | "set-handicap"
  | "game-handicap"
  | "total-games"
  | "total-games-per-set"
  | "aces"
  | "tiebreak"
  | "first-set"
  | "double-result"
  | "live";

/** Marché tennis. */
export type TennisMarket = {
  /** Identifiant unique du marché. */
  id: string;
  /** Nom affiché (FR). */
  label: string;
  /** Catégorie. */
  category: MarketCategory;
  /** Fonction de calcul. */
  compute: "markov" | "poisson" | "skellam" | "tiebreak" | "blend" | "dp";
  /** Paramètres additionnels (seuils, handicaps, etc.). */
  params?: Record<string, unknown>;
  /** Marché disponible en live uniquement. */
  liveOnly?: boolean;
  /** Marché disponible en prematch uniquement. */
  prematchOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Tous les marchés tennis supportés. */
export const TENNIS_MARKETS: TennisMarket[] = [
  // --- Match Winner ---
  { id: "match-winner", label: "Vainqueur du match", category: "match-winner", compute: "markov" },

  // --- Set Score ---
  { id: "correct-score-2-0", label: "Score exact 2-0", category: "set-score", compute: "dp", params: { targetA: 2, targetB: 0 } },
  { id: "correct-score-2-1", label: "Score exact 2-1", category: "set-score", compute: "dp", params: { targetA: 2, targetB: 1 } },
  { id: "correct-score-0-2", label: "Score exact 0-2", category: "set-score", compute: "dp", params: { targetA: 0, targetB: 2 } },
  { id: "correct-score-1-2", label: "Score exact 1-2", category: "set-score", compute: "dp", params: { targetA: 1, targetB: 2 } },

  // --- Set Handicap ---
  { id: "set-handicap-1.5", label: "Handicap sets -1.5", category: "set-handicap", compute: "markov", params: { handicap: -1.5 } },
  { id: "set-handicap+1.5", label: "Handicap sets +1.5", category: "set-handicap", compute: "markov", params: { handicap: 1.5 } },
  { id: "set-handicap-2.5", label: "Handicap sets -2.5", category: "set-handicap", compute: "markov", params: { handicap: -2.5 }, prematchOnly: true },
  { id: "set-handicap+2.5", label: "Handicap sets +2.5", category: "set-handicap", compute: "markov", params: { handicap: 2.5 }, prematchOnly: true },

  // --- Game Handicap ---
  { id: "game-handicap-2.5", label: "Handicap jeux -2.5", category: "game-handicap", compute: "poisson", params: { handicap: -2.5 } },
  { id: "game-handicap+2.5", label: "Handicap jeux +2.5", category: "game-handicap", compute: "poisson", params: { handicap: 2.5 } },
  { id: "game-handicap-4.5", label: "Handicap jeux -4.5", category: "game-handicap", compute: "poisson", params: { handicap: -4.5 } },
  { id: "game-handicap+4.5", label: "Handicap jeux +4.5", category: "game-handicap", compute: "poisson", params: { handicap: 4.5 } },

  // --- Total Games ---
  { id: "total-over-18.5", label: "Total Over 18.5", category: "total-games", compute: "poisson", params: { threshold: 18.5 } },
  { id: "total-under-18.5", label: "Total Under 18.5", category: "total-games", compute: "poisson", params: { threshold: 18.5 } },
  { id: "total-over-19.5", label: "Total Over 19.5", category: "total-games", compute: "poisson", params: { threshold: 19.5 } },
  { id: "total-under-19.5", label: "Total Under 19.5", category: "total-games", compute: "poisson", params: { threshold: 19.5 } },
  { id: "total-over-20.5", label: "Total Over 20.5", category: "total-games", compute: "poisson", params: { threshold: 20.5 } },
  { id: "total-under-20.5", label: "Total Under 20.5", category: "total-games", compute: "poisson", params: { threshold: 20.5 } },
  { id: "total-over-21.5", label: "Total Over 21.5", category: "total-games", compute: "poisson", params: { threshold: 21.5 } },
  { id: "total-under-21.5", label: "Total Under 21.5", category: "total-games", compute: "poisson", params: { threshold: 21.5 } },
  { id: "total-over-22.5", label: "Total Over 22.5", category: "total-games", compute: "poisson", params: { threshold: 22.5 } },
  { id: "total-under-22.5", label: "Total Under 22.5", category: "total-games", compute: "poisson", params: { threshold: 22.5 } },

  // --- Player Total Games ---
  { id: "player-a-over-12.5", label: "A Over 12.5 jeux", category: "total-games", compute: "poisson", params: { player: "A", threshold: 12.5 } },
  { id: "player-b-over-12.5", label: "B Over 12.5 jeux", category: "total-games", compute: "poisson", params: { player: "B", threshold: 12.5 } },

  // --- Total Games Per Set (1xBet) ---
  // Probabilité que le set N ait ≥ threshold jeux. Modèle Markov conditionnel :
  // P(set_jeux ≥ k) = Σ_{i+j=k} P(set score i-j) pour tous les scores atteignables.
  { id: "set-over-6.5", label: "Set Over 6.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 6.5 } },
  { id: "set-over-7.5", label: "Set Over 7.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 7.5 } },
  { id: "set-over-8.5", label: "Set Over 8.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 8.5 } },
  { id: "set-over-9.5", label: "Set Over 9.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 9.5 } },
  { id: "set-over-10.5", label: "Set Over 10.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 10.5 } },
  { id: "set-under-6.5", label: "Set Under 6.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 6.5 } },
  { id: "set-under-7.5", label: "Set Under 7.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 7.5 } },
  { id: "set-under-8.5", label: "Set Under 8.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 8.5 } },
  { id: "set-under-9.5", label: "Set Under 9.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 9.5 } },
  { id: "set-under-10.5", label: "Set Under 10.5 jeux", category: "total-games-per-set", compute: "markov", params: { threshold: 10.5 } },

  // --- Aces ---
  { id: "aces-over-9.5", label: "Total aces Over 9.5", category: "aces", compute: "skellam", params: { threshold: 9.5 } },
  { id: "aces-under-9.5", label: "Total aces Under 9.5", category: "aces", compute: "skellam", params: { threshold: 9.5 } },
  { id: "aces-over-12.5", label: "Total aces Over 12.5", category: "aces", compute: "skellam", params: { threshold: 12.5 } },
  { id: "aces-under-12.5", label: "Total aces Under 12.5", category: "aces", compute: "skellam", params: { threshold: 12.5 } },
  { id: "aces-over-15.5", label: "Total aces Over 15.5", category: "aces", compute: "skellam", params: { threshold: 15.5 } },
  { id: "aces-under-15.5", label: "Total aces Under 15.5", category: "aces", compute: "skellam", params: { threshold: 15.5 } },
  { id: "most-aces-a", label: "Plus d'aces : A", category: "aces", compute: "skellam" },
  { id: "most-aces-b", label: "Plus d'aces : B", category: "aces", compute: "skellam" },

  // --- Tiebreak ---
  { id: "tiebreak-yes", label: "Tiebreak dans le match", category: "tiebreak", compute: "tiebreak" },
  { id: "tiebreak-no", label: "Pas de tiebreak", category: "tiebreak", compute: "tiebreak" },
  { id: "first-set-tiebreak", label: "Tiebreak au 1er set", category: "tiebreak", compute: "tiebreak" },

  // --- First Set ---
  { id: "first-set-winner-a", label: "1er set : A", category: "first-set", compute: "markov" },
  { id: "first-set-winner-b", label: "1er set : B", category: "first-set", compute: "markov" },
  { id: "first-set-over-9.5", label: "1er set Over 9.5", category: "first-set", compute: "poisson", params: { threshold: 9.5 } },
  { id: "first-set-under-9.5", label: "1er set Under 9.5", category: "first-set", compute: "poisson", params: { threshold: 9.5 } },

  // --- Double Result ---
  { id: "double-a-a", label: "A gagne 1er set + match", category: "double-result", compute: "markov" },
  { id: "double-b-b", label: "B gagne 1er set + match", category: "double-result", compute: "markov" },
  { id: "double-a-b", label: "A gagne 1er set, B gagne match", category: "double-result", compute: "markov" },
  { id: "double-b-a", label: "B gagne 1er set, A gagne match", category: "double-result", compute: "markov" },

  // --- Live ---
  { id: "live-match-winner", label: "Vainqueur (live)", category: "live", compute: "blend", liveOnly: true },
  { id: "live-set-winner", label: "Vainqueur set en cours", category: "live", compute: "blend", liveOnly: true },
  { id: "live-next-game", label: "Prochain jeu", category: "live", compute: "markov", liveOnly: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trouve un marché par son ID. */
export function getMarketById(id: string): TennisMarket | undefined {
  return TENNIS_MARKETS.find(m => m.id === id);
}

/** Filtre les marchés par catégorie. */
export function getMarketsByCategory(category: MarketCategory): TennisMarket[] {
  return TENNIS_MARKETS.filter(m => m.category === category);
}

/** Filtre les marchés par type de calcul. */
export function getMarketsByCompute(compute: TennisMarket["compute"]): TennisMarket[] {
  return TENNIS_MARKETS.filter(m => m.compute === compute);
}

/** Marchés disponibles en live uniquement. */
export function getLiveOnlyMarkets(): TennisMarket[] {
  return TENNIS_MARKETS.filter(m => m.liveOnly);
}

/** Marchés disponibles en prematch uniquement. */
export function getPrematchOnlyMarkets(): TennisMarket[] {
  return TENNIS_MARKETS.filter(m => m.prematchOnly);
}

/** Nombre total de marchés supportés. */
export const MARKET_COUNT = TENNIS_MARKETS.length;
