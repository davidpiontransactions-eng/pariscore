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

import {
  expectedRemainingGames,
  setScoreDistribution,
  setOverUnder,
  clearAllMemos,
} from "./live-markov";

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
  /** Probabilités de victoire implicites marché (BSD live odds). */
  liveProbA?: number;
  liveProbB?: number;
  /** Joueur au service (pour le set en cours). */
  server?: "A" | "B";
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
  /** P(Over 7.5 jeux set courant) [0..100] — live seulement. */
  setOver75: number;
  /** P(Under 12.5 jeux set courant) [0..100] — live seulement. */
  setUnder125: number;
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
 * Approche additive (robuste) + correction serveur α (Lei, Lin, Cao 2024,
 * "Rhythms of Victory", équation 7) :
 *   pServe(A) = A.servePtsWonPct + 0.5 × (B.returnPtsWonPct − tourAvg_return)
 *   puis pServe *= α, avec α = (1−p1) / (p1 × serve × return)
 *
 * La correction α capte l'avantage structurel du serveur : quand p1 est élevé
 * (A domine déjà), α < 1 lisse l'effet ; quand p1 ≈ 0.5, α ≈ 1 (neutre).
 * Coefficient 0.3 sur α pour éviter de perturber la calibration déjà validée.
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

  // Chemin stats : approche additive + correction α (Lei 2024).
  if (f != null && oppReturn != null) {
    let pServe = f + 0.5 * (oppReturn - TOUR_RETURN);
    // Correction α = (1−p1) / (p1·serve·return). Borne pour stabilité.
    const p1 = clamp(pServe, 0.5, 0.78);
    const serve = clamp(f, 0.5, 0.78);
    const ret = clamp(oppReturn, 0.2, 0.5);
    const alpha = clamp((1 - p1) / (p1 * serve * ret), 0.85, 1.15);
    pServe = pServe * (0.7 + 0.3 * alpha); // 70% additive pur + 30% corrigé
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
  let setOver75 = 50;
  let setUnder125 = 50;
  if (liveCtx) {
    gamesAlreadyPlayed = liveCtx.gamesPlayed;
    const { lambdaRestant, setOver75: o75, setUnder125: u125 } = adjustLambdaLive(lambdaPrematch, liveCtx, bestOf, pHoldA, pHoldB);
    lambda = gamesAlreadyPlayed + lambdaRestant;
    setOver75 = o75;
    setUnder125 = u125;
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
    setOver75,
    setUnder125,
    recommendedBet,
    source,
  };
}

/**
 * Ajuste λ (total games attendu) en mode live.
 *
 * Nouveau modèle (v2) : remplace l'odomètre statique par une récursion Markov
 * score-conditionnée. Le λ final est maintenant sensible à :
 *   - QUI mène (pas seulement combien de sets/joués)
 *   - La force de service observée en live (via holdA/B déjà computed)
 *   - La probabilité implicite marché (liveProbA/B → E[sets restants])
 *
 * Formule : λ_restant = E[jeux restants set en cours | score] +
 *                       Σ_sets E[games/set] × P(set encore joué)
 *
 * Le old modèle ajoutait +1.0 par jeu (odomètre) — le nouveau peut
 * DESCENDRE quand un joueur domine (sets courts 6-2 6-3) ou MONTER
 * quand c'est serré (tiebreaks, sets longs).
 */
function adjustLambdaLive(
  lambdaPrematch: number,
  ctx: LiveGamesContext,
  bestOf: 3 | 5,
  pHoldA: number,
  pHoldB: number,
): { lambdaRestant: number; setOver75: number; setUnder125: number } {
  if (ctx.gamesPlayed === 0) {
    return { lambdaRestant: lambdaPrematch, setOver75: 50, setUnder125: 50 };
  }

  // Reset mémoïsations Markov : borne la mémoire en process long et garantit
  // un recalcul frais à chaque poll (les clés incluent les holds, le clear
  // est redondant pour la justesse mais pas pour la taille des Maps).
  clearAllMemos();

  // Biais assumé si le serveur est inconnu : on crédite A du hold.
  const server = ctx.server ?? "A";
  const [gA, gB] = ctx.currentSetGames;

  // 1. E[jeux restants dans le set en cours] — Markov récursion
  const erSetCurrent = expectedRemainingGames(pHoldA, pHoldB, server, gA, gB);

  // 2. Distribution des scores terminaux → Over 7,5 / Under 12,5
  const dist = setScoreDistribution(pHoldA, pHoldB, server, gA, gB);
  const { over75, under125 } = setOverUnder(dist);

  // 3. E[sets restants] pondérée par liveProb (implicite marché)
  const setsWonA = ctx.setsWon[0];
  const setsWonB = ctx.setsWon[1];
  const setsNeeded = bestOf === 3 ? 2 : 3;

  let eSetsRestants: number;
  // liveProbA/B sont en % (0-100, cf. bsd-fetcher). Si A absent mais B
  // présent → déduction symétrique ; sinon neutre 50%.
  const livePctA =
    ctx.liveProbA ?? (ctx.liveProbB != null ? 100 - ctx.liveProbB : 50);

  if (setsWonA >= setsNeeded || setsWonB >= setsNeeded) {
    eSetsRestants = 0;
  } else if (setsWonA + setsWonB === 0) {
    const pWinA = livePctA / 100;
    const q = 1 - pWinA;
    if (bestOf === 3) {
      eSetsRestants = 2 * (pWinA * pWinA + q * q) + 3 * (2 * pWinA * q) + 4 * 0.05;
    } else {
      eSetsRestants = 4.0 - (pWinA > 0.7 ? 0.5 : pWinA < 0.3 ? 0.5 : 0);
    }
  } else {
    if (bestOf === 3) {
      // Mené 1-0 en BO3 : E[sets à jouer] = 1.35 (= 1 + q avec q≈0.35).
      // Les deux branches lead/trail donnent la même valeur → constante.
      eSetsRestants = 1.35;
    } else {
      eSetsRestants = 3.0;
    }
  }

  // 4. E[jeux dans les sets restants après celui-ci
  const avgDensity = ((pHoldA + pHoldB) / 2) * 12;
  const erSetsAfter = eSetsRestants * avgDensity;

  // 5. Total restant = set courant + sets après
  const lambdaRestant = erSetCurrent + erSetsAfter;

  // setOver75/setUnder125 : convertis en % [0..100] ici (contrat du type
  // TotalGamesPrediction) car setOverUnder retourne des probas brutes 0-1.
  return {
    lambdaRestant: Math.max(2, lambdaRestant),
    setOver75: Math.round(over75 * 100),
    setUnder125: Math.round(under125 * 100),
  };
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
