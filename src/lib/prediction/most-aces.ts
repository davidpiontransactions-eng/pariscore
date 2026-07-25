// Prédiction Most Aces — comparaison A vs B + Over/Under total.
//
// Modèle : Poisson-Skellam (différence de 2 Poisson indépendantes).
//   - λA = espérance d'aces du joueur A, calibrée par surface + profil serve.
//   - P(A > B aces) = Σ SkellamPMF(k>0) via fonction de Bessel modifiée I_|k|.
//   - P(Over X.5 total) = 1 − CDF Poisson(λA+λB).
//
// Calibration empirique (sources : Pinnacle, Smarkets, ATP Tour stats) :
//   ATP best-of-3 — aces totaux moyens : Grass 9.5 / Hard 8.0 / Clay 5.7
//   Pattern surface : Grass > Hard > Clay (clay = −29% vs hard, Smarkets).
//
// Toutes les formules fermées (O(1)) → utilisable en live (poll 8s).

import type { PredictionSurface, LiveGamesContext } from "./total-games";

/** Stats aces/serve d'un joueur (depuis cache DR étendu ou fallback). */
export type AcesStats = {
  /** % de points d'ace [0..100] (médiane 10 derniers matchs surface). Ex: 8.5. */
  acesPct: number | null;
  /** % de points gagnés au service [0..1]. Ex: 0.72. */
  servePtsWonPct: number | null;
  /** % de points gagnés au retour [0..1]. Ex: 0.32. */
  returnPtsWonPct: number | null;
};

export type MostAcesPrediction = {
  /** E[aces A] dans le match. */
  lambdaA: number;
  /** E[aces B]. */
  lambdaB: number;
  /** E[aces totaux] = λA + λB. */
  lambdaTotal: number;
  /** P(A fait strictement plus d'aces que B) [0..100]. */
  probAMoreAces: number;
  /** P(B fait strictement plus d'aces que A) [0..100]. */
  probBMoreAces: number;
  /** P(A = B aces) [0..100]. */
  probTie: number;
  /** P(A gagne le marché most aces, tie réparti moitié-moitié) [0..100]. */
  probAWinsMarket: number;
  /** P(Over 9.5 aces totaux) [0..100]. */
  over9_5: number;
  /** P(Over 12.5 aces totaux) [0..100]. */
  over12_5: number;
  /** P(Over 15.5 aces totaux) [0..100]. */
  over15_5: number;
  /** Reco = marché (matchup ou total) dont la proba est la plus proche de 60%. */
  recommendedBet: {
    market: "matchup" | "total";
    direction: string; // "A" | "B" | "over" | "under"
    prob: number;
    threshold?: number;
  };
  /** Source (debug). */
  source: "stats" | "surface-fallback";
};

// ---------------------------------------------------------------------------
// Constantes de calibration
// ---------------------------------------------------------------------------

/** λ aces PAR JOUEUR de base par surface (best-of-3, demi du total cumulé).
 *  Source : Pinnacle (~0.5 ace/game ATP), Smarkets (clay −29% vs hard).
 *  Sur 18 jeux de service (~un match BO3 standard) :
 *    Hard : 0.5 × 18 × 2 joueurs / 2 = ~4.5/joueur, ajusté à 4.0 (conservateur)
 *    Grass : +19% vs Hard → ~4.75
 *    Clay : −29% vs Hard → ~2.85 */
const ACES_LAMBDA_BASE: Record<PredictionSurface, number> = {
  Grass: 4.75,
  Hard: 4.0,
  Clay: 2.85,
};

/** % aces moyen par surface (moyenne tour, pour normalisation du profil joueur).
 *  Source : ATP stats — aces / points de service. */
const ACES_PCT_AVG: Record<PredictionSurface, number> = {
  Grass: 7.5,
  Hard: 6.0,
  Clay: 4.5,
};

/** E[jeux de service par joueur] dans un BO3 — dérive du total games / 2.
 *  On prend ~9.5 (≈ 19 games match / 2). Ajusté dynamiquement via bestOf. */
const SERVICE_GAMES_BO3 = 9.5;
const SERVICE_GAMES_BO5 = 20.0;

// ---------------------------------------------------------------------------
// Bessel I_k (fonction de Bessel modifiée de 1re espèce, ordre entier)
// ---------------------------------------------------------------------------

/**
 * I_k(z) via série entière tronquée. Stable pour petits k et z modéré.
 * Formule : I_k(z) = Σ_{m=0}^{M} (z/2)^(2m+k) / (m! × (m+k)!)
 */
export function besselI(k: number, z: number): number {
  // k doit être entier (positif via |k| dans Skellam).
  const order = Math.abs(Math.round(k));
  const halfZ = z / 2;

  // 1er terme (m=0) : (z/2)^order / order!
  let term = Math.pow(halfZ, order);
  for (let i = 1; i <= order; i++) term /= i;
  let sum = term;

  // Termes suivants : multiplier par (z/2)^2 / ((m+1) × (m+1+order)).
  for (let m = 0; m < 30; m++) {
    const next = (term * halfZ * halfZ) / ((m + 1) * (m + 1 + order));
    if (next < 1e-12 * sum || !isFinite(next)) break;
    term = next;
    sum += term;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Skellam PMF (différence de 2 Poisson indépendantes)
// ---------------------------------------------------------------------------

/**
 * P(D = k) où D = Poisson(λA) − Poisson(λB).
 * SkellamPMF(k, λA, λB) = e^(−(λA+λB)) × (λA/λB)^(k/2) × I_|k|(2√(λA·λB))
 */
export function skellamPMF(k: number, lambdaA: number, lambdaB: number): number {
  if (lambdaA <= 0 || lambdaB <= 0) {
    // Cas dégénéré : si λA=0, A fait toujours 0 ace → D = −B.
    if (lambdaA === 0 && lambdaB === 0) return k === 0 ? 1 : 0;
    // Approx : on évite la division par zéro en clampant.
  }
  const la = Math.max(lambdaA, 1e-6);
  const lb = Math.max(lambdaB, 1e-6);
  const ratio = la / lb;
  const besselArg = 2 * Math.sqrt(la * lb);
  return (
    Math.exp(-(la + lb)) *
    Math.pow(ratio, k / 2) *
    besselI(k, besselArg)
  );
}

/** Poisson PMF (réutilisé depuis total-games mais local pour éviter couplage). */
function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

// ---------------------------------------------------------------------------
// λ aces d'un joueur
// ---------------------------------------------------------------------------

/**
 * E[aces du joueur] dans le match.
 *
 *   λA = λBase(surface) × (acesPctA / acesPctMoyen)
 *        × (1 + ajustement retour adverse)
 *
 * Le λBase est déjà calibré pour un joueur moyen sur E[jeux service] standard.
 * On ajuste par le profil serve/return du joueur et de l'adversaire.
 */
function computeLambdaAces(
  player: AcesStats,
  opponent: AcesStats,
  surface: PredictionSurface,
  bestOf: 3 | 5,
): number {
  const lambdaBase = ACES_LAMBDA_BASE[surface];
  const acesAvg = ACES_PCT_AVG[surface];

  // Ajustement profil aces du joueur : un joueur qui fait 2× plus d'aces que
  // la moyenne tour fera ~2× plus que λBase. Borné pour éviter les extrêmes.
  let acesMultiplier = 1;
  if (player.acesPct != null && acesAvg > 0) {
    acesMultiplier = clamp(player.acesPct / acesAvg, 0.3, 2.5);
  }

  // Ajustement retour adverse : un mauvais retourneur subit plus d'aces.
  // Heuristique : +30% si oppReturn = 0 (nul), 0% si oppReturn = 0.36 (moyen).
  const oppReturn = opponent.returnPtsWonPct ?? 0.36;
  const returnAdjustment = 1 + 0.3 * (0.36 - oppReturn);

  // Ajustement format : best-of-5 = ~2× plus de jeux de service.
  const formatMultiplier = bestOf === 5
    ? SERVICE_GAMES_BO5 / SERVICE_GAMES_BO3
    : 1;

  return clamp(
    lambdaBase * acesMultiplier * returnAdjustment * formatMultiplier,
    0.3,
    25,
  );
}

// ---------------------------------------------------------------------------
// Pipeline complet
// ---------------------------------------------------------------------------

/**
 * Prédiction Most Aces complète : comparaison A vs B + Over/Under total.
 *
 * @param playerA   Stats aces/serve de A (depuis cache DR étendu).
 * @param playerB   Stats aces/serve de B.
 * @param surface   Surface (Hard/Clay/Grass).
 * @param bestOf    Format (3 ou 5).
 * @param liveCtx   Optionnel — contexte live pour recalculer les λ restants.
 */
export function predictMostAces(
  playerA: AcesStats,
  playerB: AcesStats,
  surface: PredictionSurface,
  bestOf: 3 | 5,
  liveCtx?: LiveGamesContext,
): MostAcesPrediction {
  // 1. λ aces de chaque joueur.
  let lambdaA = computeLambdaAces(playerA, playerB, surface, bestOf);
  let lambdaB = computeLambdaAces(playerB, playerA, surface, bestOf);

  // Source : si au moins un joueur a ses acesPct, on est en mode "stats".
  const source: "stats" | "surface-fallback" =
    playerA.acesPct != null || playerB.acesPct != null
      ? "stats"
      : "surface-fallback";

  // 2. Ajustement live : réduit proportionnellement aux jeux restants.
  //    On préserve le RATIO λA/λB (qui reflète l'avantage serve) en appliquant
  //    un facteur commun aux deux, puis on garantit un plancher total (≥3 aces
  //    restants) pour éviter l'effondrement Poisson quand λ→0.
  if (liveCtx && liveCtx.gamesPlayed > 0) {
    const eTotalServiceGames =
      (bestOf === 3 ? SERVICE_GAMES_BO3 : SERVICE_GAMES_BO5) * 2; // 2 joueurs
    const factorRemaining = clamp(
      (eTotalServiceGames - liveCtx.gamesPlayed) / eTotalServiceGames,
      0.15,
      1,
    );
    let newA = lambdaA * factorRemaining;
    let newB = lambdaB * factorRemaining;
    // Plancher total 3 aces restants, réparti au prorata (préserve le ratio).
    const total = newA + newB;
    if (total < 3 && total > 0) {
      const scale = 3 / total;
      newA *= scale;
      newB *= scale;
    }
    lambdaA = newA;
    lambdaB = newB;
  }

  const lambdaTotal = lambdaA + lambdaB;

  // 3. P(A > B), P(A = B), P(B > A) via Skellam.
  //    Tronquer à Kmax = 20 (au-delà, PMF négligeable).
  const KMAX = 20;
  let pAGreater = 0;
  let pEqual = 0;
  for (let k = -KMAX; k <= KMAX; k++) {
    const pmf = skellamPMF(k, lambdaA, lambdaB);
    if (k > 0) pAGreater += pmf;
    else if (k === 0) pEqual += pmf;
  }
  const pBGreater = Math.max(0, 1 - pAGreater - pEqual);

  // Marché matchup : le tie est réparti moitié-moitié (convention bookmaker).
  const pAWinsMarket = pAGreater + 0.5 * pEqual;

  // 4. P(Over X.5) pour les 3 seuils totaux.
  const over9_5 = probOverAces(9.5, lambdaTotal);
  const over12_5 = probOverAces(12.5, lambdaTotal);
  const over15_5 = probOverAces(15.5, lambdaTotal);

  // 5. Reco : marché avec proba la plus proche de 60%.
  const candidates: Array<{
    market: "matchup" | "total";
    direction: string;
    prob: number;
    threshold?: number;
  }> = [
    { market: "matchup", direction: pAWinsMarket >= 0.5 ? "A" : "B", prob: Math.round(Math.max(pAWinsMarket, 1 - pAWinsMarket) * 100) },
    { market: "total", direction: "over", prob: Math.round(over9_5 * 100), threshold: 9.5 },
    { market: "total", direction: "over", prob: Math.round(over12_5 * 100), threshold: 12.5 },
    { market: "total", direction: "over", prob: Math.round(over15_5 * 100), threshold: 15.5 },
  ];
  const recommendedBet = candidates.reduce((best, c) =>
    Math.abs(c.prob - 60) < Math.abs(best.prob - 60) ? c : best,
  );

  return {
    lambdaA: Math.round(lambdaA * 10) / 10,
    lambdaB: Math.round(lambdaB * 10) / 10,
    lambdaTotal: Math.round(lambdaTotal * 10) / 10,
    probAMoreAces: Math.round(pAGreater * 100),
    probBMoreAces: Math.round(pBGreater * 100),
    probTie: Math.round(pEqual * 100),
    probAWinsMarket: Math.round(pAWinsMarket * 100),
    over9_5: Math.round(over9_5 * 100),
    over12_5: Math.round(over12_5 * 100),
    over15_5: Math.round(over15_5 * 100),
    recommendedBet,
    source,
  };
}

/** P(Over X.5 aces totaux) = 1 − Σ_{k=0}^{floor(X.5)} PoissonPMF(k, λ). */
function probOverAces(halfThreshold: number, lambda: number): number {
  const kMax = Math.floor(halfThreshold);
  let cumulative = 0;
  for (let k = 0; k <= kMax; k++) cumulative += poissonPMF(k, lambda);
  return clamp(1 - cumulative, 0, 1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
