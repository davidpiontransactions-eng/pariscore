// Prédiction Over/Under Total Games — modèle Barnett-Clarke + Poisson.
//
// Reconstruit depuis la littérature académique (Barnett & Clarke 2005,
// "Combining player statistics to predict outcomes of tennis matches" ;
// Barnett 2006, forme fermée pHold ; Poisson pour P(Over X.5)).
//
// Pipeline :
//   1. pServe  = Barnett-Clarke combining formula (own serve% × opp return%)
//   2. pHold   = forme fermée Barnett (chaîne de Markov 0/15/30/40/Ad fermée)
//   3. λ       = E[total games] = surface baseline + ajustement (pHold gap)
//   4. P(Over X.5) = 1 − Σ PoissonPMF(k, λ) pour k ≤ floor(X.5)
//   5. Live    : λ_restant = λ_initial × (setsRestants/setsTotaux) − gamesJoués
//
// Toutes les formules sont fermées (O(1)) → utilisable en live (poll 8s).
// Pas de Monte-Carlo en runtime (réservé à la calibration hors-ligne).

export type PredictionSurface = "Hard" | "Clay" | "Grass";

/** Stats de service/retour d'un joueur (depuis cache DR étendu ou fallback). */
export type ServeStats = {
  /** Fraction de points gagnés au service [0..1]. Ex: 0.69 = 69%. */
  servePtsWonPct: number | null;
  /** Fraction de points gagnés au retour [0..1]. Ex: 0.32 = 32%. */
  returnPtsWonPct: number | null;
};

export type LiveGamesContext = {
  /** Nombre de games déjà joués (somme sets terminés + jeux set en cours). */
  gamesPlayed: number;
  /** Sets gagnés par A et B (ex: [1, 0] = A mène 1 set à 0). */
  setsWon: [number, number];
  /** Score de jeux du set en cours [A, B] (ex: [4, 3]). */
  currentSetGames: [number, number];
};

export type TotalGamesPrediction = {
  /** Probabilités de point sur service (combinaison Barnett-Clarke). */
  pServeA: number;
  pServeB: number;
  /** Probabilités de gain du jeu de service (forme fermée Barnett). */
  pHoldA: number;
  pHoldB: number;
  /** Espérance du nombre total de games (prematch = total, live = restant). */
  lambda: number;
  /** P(Over 18.5) [0..100]. */
  over18_5: number;
  /** P(Over 19.5) [0..100]. */
  over19_5: number;
  /** P(Over 21.5) [0..100]. */
  over21_5: number;
  /** Seuil recommandé = celui dont la proba Over est la plus proche de 60%
   *  (le plus "value", ni trop évident ni trop risqué). */
  recommendedBet: {
    threshold: 18.5 | 19.5 | 21.5;
    direction: "over" | "under";
    prob: number;
  };
  /** Source du modèle (debug). */
  source: "stats" | "elo-fallback" | "surface-fallback";
};

// ---------------------------------------------------------------------------
// Constantes de calibration (best-of-3, source: TennisForm + Betaminic)
// ---------------------------------------------------------------------------

/** Espérance de games par SET par surface (moyennes empiriques ATP/WTA). */
const GAMES_PER_SET: Record<PredictionSurface, number> = {
  Grass: 10.0, // serve dominant + tiebreaks fréquents
  Hard: 9.7,
  Clay: 9.3, // plus de breaks, sets plus courts en games
};

/** Espérance de sets par match (best-of-3). Empiriquement ATP/WTA ≈ 2.10
 *  (≈ 65% de matchs en 2 sets secs, 35% en 3 sets). Ajusté par écart Elo. */
const BASE_SETS_BO3 = 2.10;

/** Moyenne tour du % de points gagnés au service (ATP/WTA ≈ 0.64). */
const TOUR_SERVE_PCT = 0.64;

/** Écart-type résiduel de Poisson pour ajustement variance tennis. La distr.
 *  Poisson pure sous-estime les queues (tiebreaks, 3 sets) → on l'inflèche. */
const VARIANCE_INFLATOR = 1.10;

// ---------------------------------------------------------------------------
// Étape 1 — Barnett-Clarke combining formula
// ---------------------------------------------------------------------------

/**
 * pServe(A vs B) : probabilité que A gagne un point sur son service contre B.
 *
 * Implémente une approche additive (robuste) plutôt que la forme multiplicative
 * de Barnett-Clarke qui nécessite une normalization tour-by-tour délicate :
 *   pServe(A) = A.servePtsWonPct + 0.5 × (B.returnPtsWonPct − tourAvg_return)
 *
 * Le % de service d'un joueur EST déjà sa pServe contre un adversaire moyen.
 * On l'ajuste par la qualité du retour adverse (poids 0.5 pour éviter
 * double-compte avec le propre retour de A).
 *
 * Si stats manquantes → fallback Elo-derived (0.62 + 0.0002·(elo−1500)).
 */
export function computePServe(
  player: ServeStats,
  opponent: ServeStats,
  elo?: number,
): { pServe: number; source: "stats" | "elo-fallback" | "surface-fallback" } {
  const f = player.servePtsWonPct;
  const oppReturn = opponent.returnPtsWonPct;
  const TOUR_RETURN = 1 - TOUR_SERVE_PCT; // ≈ 0.36

  // Chemin stats : approche additive.
  if (f != null && oppReturn != null) {
    const pServe = f + 0.5 * (oppReturn - TOUR_RETURN);
    return { pServe: clamp(pServe, 0.5, 0.78), source: "stats" };
  }

  // Fallback Elo : joueurs dont on n'a pas les stats serve (hors top-200).
  if (elo != null) {
    const pServe = clamp(0.62 + 0.0002 * (elo - 1500), 0.55, 0.72);
    return { pServe, source: "elo-fallback" };
  }

  // Dernier recours : moyenne tour.
  return { pServe: TOUR_SERVE_PCT, source: "surface-fallback" };
}

// ---------------------------------------------------------------------------
// Étape 2 — pHold : forme fermée Barnett (chaîne de Markov point→game)
// ---------------------------------------------------------------------------

/**
 * P(gagner son jeu de service) depuis p(point sur service).
 * Chaîne de Markov point→game standard tennis (0/15/30/40/Ad avec deuce).
 *
 * P(hold) = P(gain sans deuce) + P(atteindre deuce) × P(hold | deuce)
 *   P(sans deuce) = p^4 + 4·p^4·(1−p) + 10·p^4·(1−p)^2   (40-0, 40-15, 40-30)
 *   P(deuce)      = 20·p^3·(1−p)^3                          (3-3 après 6 points)
 *   P(hold|deuce) = p^2 / [p^2 + (1−p)^2]                  (2 points consécutifs)
 *
 * Pour pServe=0.64 → pHold≈0.813 (cohérent empirique ATP ~80-82%).
 */
export function computePHold(pServe: number): number {
  const p = clamp(pServe, 0.4, 0.85);
  const q = 1 - p;
  // Gain direct : 4-0, 4-1, 4-2 (serveur perd ≤2 points).
  const noDeuce =
    Math.pow(p, 4) + // 40-0
    4 * Math.pow(p, 4) * q + // 40-15 (1 seul point perdu, 4 positions)
    10 * Math.pow(p, 4) * q * q; // 40-30 (2 points perdus, C(4,2)=6 positions)
  // Atteindre 40-40 (deuce) : 3-3 après 6 points joués, C(6,3)=20 arrangements.
  const reachDeuce = 20 * Math.pow(p, 3) * Math.pow(q, 3);
  // P(hold | deuce) = gagner 2 points consécutifs avant d'en perdre 2.
  const holdFromDeuce = (p * p) / (p * p + q * q);
  return clamp(noDeuce + reachDeuce * holdFromDeuce, 0.5, 0.97);
}

// ---------------------------------------------------------------------------
// Étape 3 — λ (E[total games] best-of-3)
// ---------------------------------------------------------------------------

/**
 * Espérance du nombre total de games dans un match best-of-3.
 *
 * Modèle : λ = avgGamesPerSet(surface) × E[sets] + ajustement (pHold gap).
 * - Match équilibré (pHoldA≈pHoldB ≈ 0.80) → beaucoup de 6-4/7-5/tiebreaks → λ↑
 * - Match déséquilibré (un joueur pHold≫autre) → 6-2 6-2 = 16 games → λ↓
 * - Deux gros serveurs (pHoldA≈pHoldB≈0.88) → tiebreak quasi sûr → λ↑↑
 */
export function computeLambda(
  pHoldA: number,
  pHoldB: number,
  surface: PredictionSurface,
  bestOf: 3 | 5,
): number {
  const gamesPerSet = GAMES_PER_SET[surface];

  // E[sets] : légèrement > 2 si match serré (plus de 3 sets probables).
  // Dérive du |pHoldA − pHoldB| : écart faible → plus de sets.
  const holdGap = Math.abs(pHoldA - pHoldB);
  const setsMultiplier = bestOf === 3 ? BASE_SETS_BO3 : 4.0; // BO5 ≈ 3.8-4.2 sets
  const balanceAdjustment = (1 - holdGap) * 0.15; // +0.15 set si parfaitement équilibré
  const eSets = setsMultiplier + balanceAdjustment;

  // Ajustement tiebreak : deux gros serveurs → +bonus (probabilité de TB ↑).
  const avgHold = (pHoldA + pHoldB) / 2;
  const tiebreakBonus = avgHold > 0.85 ? (avgHold - 0.85) * 20 : 0; // jusqu'à ~+2 games

  let lambda = gamesPerSet * eSets + tiebreakBonus;

  // Pénalité si match très déséquilibré (domination → sets courts 6-1 6-2).
  if (holdGap > 0.15) {
    lambda -= (holdGap - 0.15) * 15;
  }

  // best-of-3 plafonné ~28 games (2 sets 7-6 7-6 = 26, 3 sets ≈ 30) ;
  // best-of-5 plafonné ~62 (5 sets 6-4 = 50, tiebreaks → 60+).
  const maxGames = bestOf === 3 ? 30 : 65;
  return clamp(lambda, bestOf === 3 ? 14 : 24, maxGames);
}

// ---------------------------------------------------------------------------
// Étape 4 — Poisson PMF + P(Over X.5)
// ---------------------------------------------------------------------------

/** Poisson PMF : P(X = k | λ). */
export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return k === 0 ? 1 : 0;
  // P(k) = λ^k × e^−λ / k!
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** P(total ≥ X.5) = 1 − Σ_{k=0}^{floor(X.5)} PoissonPMF(k, λ). */
export function probOver(halfThreshold: number, lambda: number): number {
  // Over 18.5 ⟺ total ≥ 19 ⟺ 1 − CDF(18).
  const kMax = Math.floor(halfThreshold);
  let cumulative = 0;
  for (let k = 0; k <= kMax; k++) {
    cumulative += poissonPMF(k, lambda);
  }
  // Variance inflator : on inflèche la queue pour mieux coller aux distributions
  // tennis empiriques (Poisson pur sous-estime P(Over) loin de la moyenne).
  const overProb = 1 - cumulative;
  return clamp(overProb * VARIANCE_INFLATOR, 0, 1);
}

// ---------------------------------------------------------------------------
// Étape 5 — Pipeline complet
// ---------------------------------------------------------------------------

/**
 * Prédiction complète Over/Under Total Games pour un match.
 *
 * @param playerA   Stats serve/return de A (depuis cache DR étendu).
 * @param playerB   Stats serve/return de B.
 * @param surface   Surface du match (Hard/Clay/Grass).
 * @param bestOf    Format (3 ou 5 sets).
 * @param eloA/eloB Elo des joueurs (pour fallback si stats manquantes).
 * @param liveCtx   Optionnel — contexte live pour recalculer λ restant.
 */
export function predictTotalGames(
  playerA: ServeStats,
  playerB: ServeStats,
  surface: PredictionSurface,
  bestOf: 3 | 5,
  eloA?: number,
  eloB?: number,
  liveCtx?: LiveGamesContext,
): TotalGamesPrediction {
  // 1-2. pServe + pHold pour chaque joueur.
  const aResult = computePServe(playerA, playerB, eloA);
  const bResult = computePServe(playerB, playerA, eloB);
  const pServeA = aResult.pServe;
  const pServeB = bResult.pServe;
  const pHoldA = computePHold(pServeA);
  const pHoldB = computePHold(pServeB);

  // 3. λ prematch (espérance du total final).
  const lambdaPrematch = computeLambda(pHoldA, pHoldB, surface, bestOf);

  // Source du modèle (on prend le "pire" des deux joueurs, le moins précis).
  const source =
    aResult.source === "stats" && bResult.source === "stats"
      ? "stats"
      : aResult.source === "surface-fallback" || bResult.source === "surface-fallback"
        ? "surface-fallback"
        : "elo-fallback";

  // 5. Ajustement live : λ devient l'espérance du TOTAL FINAL vu depuis maintenant.
  //    Sémantique : Over 21.5 = "le match fera ≥23 games au total".
  //    En live, λ_final = gamesJoués + E[restants]. Plus on avance, plus la
  //    prédiction converge vers la réalité (un match à 16 games est
  //    statistiquement plus long que la moyenne prematch → λ_final monte).
  let lambda = lambdaPrematch;
  let gamesAlreadyPlayed = 0;
  if (liveCtx) {
    gamesAlreadyPlayed = liveCtx.gamesPlayed;
    const lambdaRestant = adjustLambdaLive(lambdaPrematch, liveCtx, bestOf);
    lambda = gamesAlreadyPlayed + lambdaRestant;
  }

  // 4. P(Over X.5) pour les 3 seuils — calculé sur λ (total final attendu).
  //    Si le seuil est déjà dépassé par les games jouées → P(Over) = 100%.
  const over18_5 = gamesAlreadyPlayed > 18 ? 100 : Math.round(probOver(18.5, lambda) * 100);
  const over19_5 = gamesAlreadyPlayed > 19 ? 100 : Math.round(probOver(19.5, lambda) * 100);
  const over21_5 = gamesAlreadyPlayed > 21 ? 100 : Math.round(probOver(21.5, lambda) * 100);

  // Reco : seuil dont P(Over) est le plus proche de 60% (value sweet spot).
  const candidates: Array<{ threshold: 18.5 | 19.5 | 21.5; prob: number }> = [
    { threshold: 18.5, prob: over18_5 },
    { threshold: 19.5, prob: over19_5 },
    { threshold: 21.5, prob: over21_5 },
  ];
  const best = candidates.reduce((best, c) =>
    Math.abs(c.prob - 60) < Math.abs(best.prob - 60) ? c : best,
  );
  const direction: "over" | "under" = best.prob >= 50 ? "over" : "under";
  const recommendedBet = {
    threshold: best.threshold,
    direction,
    prob: direction === "over" ? best.prob : 100 - best.prob,
  };

  return {
    pServeA,
    pServeB,
    pHoldA,
    pHoldB,
    lambda: Math.round(lambda * 10) / 10,
    over18_5,
    over19_5,
    over21_5,
    recommendedBet,
    source,
  };
}

/**
 * Espérance de games RESTANTS vu depuis le moment live actuel.
 *
 * Modèle : E[restants] = densitéGamesParSet × E[sets restants].
 *   - densitéGamesParSet = λPrematch / E[sets]_prematch (≈ 10.8 g/set best-of-3).
 *   - E[sets restants] décroît selon le nombre de sets déjà joués :
 *       0 set joué → ~2.10 (match entier à venir)
 *       1 set joué → ~1.35 (set en cours + éventuel 3e set)
 *       2 sets joués (1-1) → ~1.0 (décisif seulement)
 *
 * Bonus tiebreak imminent (set en cours 5-5 ou 6-6) : +2/+1 games.
 *
 * Le total final prédit = gamesJoués + E[restants] augmente légèrement quand
 * le match avance (un match à 16 games est statistiquement plus long que la
 * moyenne prematch) — c'est la bonne sémantique pour P(Over).
 */
function adjustLambdaLive(
  lambdaPrematch: number,
  ctx: LiveGamesContext,
  bestOf: 3 | 5,
): number {
  if (ctx.gamesPlayed === 0) return lambdaPrematch;

  // Densité de games par set (héritée du prematch).
  const eSetsPrematch = bestOf === 3 ? BASE_SETS_BO3 : 4.0;
  const densiteParSet = lambdaPrematch / eSetsPrematch;

  // E[sets restants] selon le nombre de sets déjà joués.
  const setsJoues = ctx.setsWon[0] + ctx.setsWon[1];
  let eSetsRestants: number;
  if (bestOf === 3) {
    eSetsRestants = setsJoues === 0 ? 2.10 : setsJoues === 1 ? 1.35 : 1.0;
  } else {
    // best-of-5 : plus granulaire.
    eSetsRestants = setsJoues === 0 ? 4.0 : setsJoues === 1 ? 3.0 : setsJoues === 2 ? 2.0 : 1.2;
  }

  let lambdaRestant = densiteParSet * eSetsRestants;

  // Bonus tiebreak imminent dans le set en cours.
  const [gA, gB] = ctx.currentSetGames;
  if (gA >= 5 && gB >= 5) lambdaRestant += 2;
  else if (gA >= 6 && gB >= 6) lambdaRestant += 1;

  return Math.max(2, lambdaRestant);
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
