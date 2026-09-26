/**
 * Moteur de prédiction live tennis basé sur chaînes de Markov.
 *
 * Remplace le modèle odometer statique par une récursion Markovienne
 * qui évalue les probabilités de victoire à chaque état du match
 * (score de jeux, score de sets, service).
 *
 * Toutes les probabilités sont des floats 0-1. La mémoïsation
 * utilise des Map avec clés composites.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Joueur : A ou B */
type Player = "A" | "B";

/**
 * Clé mémoïsée : état du set + holds quantisés à 3 décimales.
 *
 * Les holds FONT PARTIE de la clé : les Maps sont module-level et partagées
 * entre tous les composants et tous les matchs. Sans elles, deux matchs au
 * même score mais de forces différentes liraient des résultats croisés
 * (stale silencieux).
 */
function memoKey(
  gamesA: number,
  gamesB: number,
  server: Player,
  holdA: number,
  holdB: number
): string {
  return `${gamesA},${gamesB},${server},${holdA.toFixed(3)},${holdB.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// Probabilité de gain de jeu (forme fermée)
// ---------------------------------------------------------------------------

/**
 * Probabilité que le serveur gagne un jeu donné p = P(gagner un point au service).
 *
 * Forme fermée exacte :
 *   P = p⁴·(1 + 4q + 10q²) + 20·p³·q³ · p²/(p²+q²)
 *
 * où q = 1 - p.
 *
 * @param p - Probabilité de gagner un point au service (0 ≤ p ≤ 1)
 * @returns Probabilité de gagner le jeu (0 ≤ result ≤ 1)
 */
export function gameWinProb(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  const q = 1 - p;
  const p2 = p * p;
  const p3 = p2 * p;
  const p4 = p3 * p;
  const q2 = q * q;
  const q3 = q2 * q;

  // Gain en 4 points (40-0, 40-15, 40-30)
  const straightWins = p4 * (1 + 4 * q + 10 * q2);

  // Gain via deuce (30-40 ou 40-40 puis avantage)
  // 20·p³·q³ = prob d'atteindre le deuce (3-3 en points)
  // puis p²/(p²+q²) = prob de gagner après le deuce
  const deucePath = 20 * p3 * q3 * (p2 / (p2 + q2));

  return straightWins + deucePath;
}

/**
 * Probabilité que le serveur perde le jeu (= l'autre joueur gagne au retour).
 *
 * @param p - Probabilité de gagner un point au service (0 ≤ p ≤ 1)
 * @returns Probabilité de break (0 ≤ result ≤ 1)
 */
export function breakProb(p: number): number {
  return 1 - gameWinProb(p);
}

// ---------------------------------------------------------------------------
// Récursion Markov — probabilité de gagner un set
// ---------------------------------------------------------------------------

/** Map de mémoïsation pour setWinProb */
const setWinMemo = new Map<string, number>();

/**
 * Probabilité que le joueur A gagne le set depuis l'état actuel.
 *
 * Récursion Markov sur les états (gA, gB, serveur).
 *
 * États terminaux :
 *   - gA ≥ 6 et gA - gB ≥ 2 → 1.0 (A gagne le set)
 *   - gB ≥ 6 et gB - gA ≥ 2 → 0.0 (B gagne le set)
 *   - 6-6 → probabilité de tiebreak (approximation statique)
 *
 * Récursion :
 *   V(gA, gB, server) = π · V(gA+1, gB) + (1-π) · V(gA, gB+1)
 *   où π = holdA si server = A, holdB si server = B
 *
 * @param holdA - Probabilité que A tienne son service (gameWinProb(pServeA))
 * @param holdB - Probabilité que B tienne son service (gameWinProb(pServeB))
 * @param setsA - Sets gagnés par A dans le match
 * @param setsB - Sets gagnés par B dans le match
 * @param currentSet - Numéro du set actuel (1-indexé)
 * @param gamesA - Jeux gagnés par A dans le set actuel
 * @param gamesB - Jeux gagnés par B dans le set actuel
 * @param serverNext - Qui sert au prochain jeu
 * @returns Probabilité que A gagne le set (0 ≤ result ≤ 1)
 */
export function setWinProb(
  holdA: number,
  holdB: number,
  _setsA: number,
  _setsB: number,
  _currentSet: number,
  gamesA: number,
  gamesB: number,
  serverNext: Player
): number {
  const key: string = memoKey(gamesA, gamesB, serverNext, holdA, holdB);

  // Vérifier la mémoïsation
  const cached = setWinMemo.get(key);
  if (cached !== undefined) return cached;

  let result: number;

  // État terminal : A gagne le set
  if (gamesA >= 6 && gamesA - gamesB >= 2) {
    result = 1.0;
  }
  // État terminal : B gagne le set
  else if (gamesB >= 6 && gamesB - gamesA >= 2) {
    result = 0.0;
  }
  // Tiebreak à 6-6 : approximation statique
  else if (gamesA === 6 && gamesB === 6) {
    // Probabilité de TB : approximation pondérée
    // On utilise la probabilité que le serveur au TB gagne
    // En TB, les joueurs alternent les services
    // Approximation : prob moyenne des deux joueurs
    const pTB = 0.5 * holdA + 0.5 * holdB;
    // Le TB est un jeu normalisé — on approxime avec gameWinProb
    // mais avec un facteur de correction (le TB est plus serré)
    result = gameWinProb(pTB);
  }
  // Récursion classique
  else {
    // pi = probabilité que A GAGNE le jeu en cours
    //   si A sert : holdA
    //   si B sert : 1 - holdB (break)
    const pi = serverNext === "A" ? holdA : 1 - holdB;
    const nextServer: Player = serverNext === "A" ? "B" : "A";

    const winA = setWinProb(holdA, holdB, _setsA, _setsB, _currentSet, gamesA + 1, gamesB, nextServer);
    const winB = setWinProb(holdA, holdB, _setsA, _setsB, _currentSet, gamesA, gamesB + 1, nextServer);

    result = pi * winA + (1 - pi) * winB;
  }

  setWinMemo.set(key, result);
  return result;
}

/**
 * Réinitialise la mémoïsation de setWinProb.
 * À appeler entre deux matchs ou quand les probabilités changent.
 */
export function clearSetWinMemo(): void {
  setWinMemo.clear();
}

// ---------------------------------------------------------------------------
// Distribution des scores de set
// ---------------------------------------------------------------------------

/** Map de mémoïsation pour setScoreDistribution */
const distMemo = new Map<string, Record<string, number>>();

/**
 * Distribution des probabilités pour chaque score terminal du set.
 *
 * Même récursion que setWinProb mais accumule la probabilité
 * à chaque état terminal au lieu de renvoyer 1.0/0.0.
 *
 * @param holdA - Probabilité que A tienne son service
 * @param holdB - Probabilité que B tienne son service
 * @param serverFirst - Qui sert au premier jeu du set
 * @param gamesA - Jeux gagnés par A dans le set actuel
 * @param gamesB - Jeux gagnés par B dans le set actuel
 * @returns Distribution des scores : { "6-0": 0.05, "6-1": 0.12, ... }
 */
export function setScoreDistribution(
  holdA: number,
  holdB: number,
  serverFirst: Player,
  gamesA: number = 0,
  gamesB: number = 0
): Record<string, number> {
  const key: string = memoKey(gamesA, gamesB, serverFirst, holdA, holdB);

  const cached = distMemo.get(key);
  if (cached !== undefined) return { ...cached };

  const dist: Record<string, number> = {};

  // État terminal : A gagne le set
  if (gamesA >= 6 && gamesA - gamesB >= 2) {
    const score = `${gamesA}-${gamesB}`;
    dist[score] = 1.0;
    distMemo.set(key, dist);
    return dist;
  }

  // État terminal : B gagne le set
  if (gamesB >= 6 && gamesB - gamesA >= 2) {
    const score = `${gamesA}-${gamesB}`;
    dist[score] = 1.0;
    distMemo.set(key, dist);
    return dist;
  }

  // Tiebreak à 6-6
  if (gamesA === 6 && gamesB === 6) {
    const pTB = 0.5 * holdA + 0.5 * holdB;
    const pWinTB = gameWinProb(pTB);

    // Les DEUX issues du TB sont des scores terminaux distincts :
    // "7-6" (A gagne le TB) et "6-7" (B gagne) — 13 jeux dans les deux cas.
    dist["7-6"] = pWinTB;
    dist["6-7"] = 1 - pWinTB;
    distMemo.set(key, dist);
    return dist;
  }

  // Récursion
  // pAWinGame = probabilité que A gagne le jeu en cours (selon qui sert)
  const pAWinGame = serverFirst === "A" ? holdA : 1 - holdB;
  const nextServer: Player = serverFirst === "A" ? "B" : "A";

  const distWinA = setScoreDistribution(holdA, holdB, nextServer, gamesA + 1, gamesB);
  const distWinB = setScoreDistribution(holdA, holdB, nextServer, gamesA, gamesB + 1);

  // Combiner les distributions
  for (const [score, prob] of Object.entries(distWinA)) {
    dist[score] = (dist[score] ?? 0) + pAWinGame * prob;
  }

  for (const [score, prob] of Object.entries(distWinB)) {
    dist[score] = (dist[score] ?? 0) + (1 - pAWinGame) * prob;
  }

  distMemo.set(key, dist);
  return dist;
}

/**
 * Réinitialise la mémoïsation de setScoreDistribution.
 */
export function clearDistMemo(): void {
  distMemo.clear();
}

// ---------------------------------------------------------------------------
// Over/Under games dans un set
// ---------------------------------------------------------------------------

/**
 * Calcule les probabilités Over 7.5 et Under 12.5 à partir
 * de la distribution des scores de set.
 *
 * Over 7.5 = P(total jeux ≥ 8) = P(6-2, 6-3, 6-4, 7-5, 7-6, etc.)
 * Under 12.5 = 1 − P(13 jeux) = 1 − P(7-6 ou 6-7)
 *
 * @param dist - Distribution des scores (ex: { "6-0": 0.05, "6-1": 0.12, ... })
 * @returns { over75, under125 } - Probabilités (0-1)
 */
export function setOverUnder(dist: Record<string, number>): {
  over75: number;
  under125: number;
} {
  let over75 = 0;

  for (const [score, prob] of Object.entries(dist)) {
    const [w, l] = score.split("-").map(Number);
    const total = w + l;

    if (total >= 8) {
      over75 += prob;
    }
  }

  // Under 12.5 = 1 − P(13 jeux) — les deux issues du TB comptent.
  const tiebreakProb = (dist["7-6"] ?? 0) + (dist["6-7"] ?? 0);
  const under125 = 1 - tiebreakProb;

  return { over75, under125 };
}

// ---------------------------------------------------------------------------
// Jeux restants attendus dans un set
// ---------------------------------------------------------------------------

/** Map de mémoïsation pour expectedRemainingGames */
const gamesMemo = new Map<string, number>();

/**
 * Nombre attendu de jeux restants dans le set depuis l'état actuel.
 *
 * Récursion Markov :
 *   - État terminal → 0 (plus de jeux)
 *   - Récursif → 1 + (π × E(après victoire serveur) + (1-π) × E(après défaite serveur))
 *
 * Le "+1" compte le jeu en cours.
 *
 * @param holdA - Probabilité que A tienne son service
 * @param holdB - Probabilité que B tienne son service
 * @param serverFirst - Qui sert au jeu actuel
 * @param gamesA - Jeux gagnés par A
 * @param gamesB - Jeux gagnés par B
 * @returns Nombre attendu de jeux restants (≥ 0)
 */
export function expectedRemainingGames(
  holdA: number,
  holdB: number,
  serverFirst: Player,
  gamesA: number = 0,
  gamesB: number = 0
): number {
  const key: string = memoKey(gamesA, gamesB, serverFirst, holdA, holdB);

  const cached = gamesMemo.get(key);
  if (cached !== undefined) return cached;

  // État terminal : set terminé
  if (
    (gamesA >= 6 && gamesA - gamesB >= 2) ||
    (gamesB >= 6 && gamesB - gamesA >= 2) ||
    (gamesA === 6 && gamesB === 6)
  ) {
    // TB = 1 jeu supplémentaire (approximation)
    const result = gamesA === 6 && gamesB === 6 ? 1 : 0;
    gamesMemo.set(key, result);
    return result;
  }

  // pi = probabilité que A GAGNE le jeu en cours
  //   si A sert : holdA
  //   si B sert : 1 - holdB (break)
  const pi = serverFirst === "A" ? holdA : 1 - holdB;
  const nextServer: Player = serverFirst === "A" ? "B" : "A";

  const restAfterWin = expectedRemainingGames(holdA, holdB, nextServer, gamesA + 1, gamesB);
  const restAfterLoss = expectedRemainingGames(holdA, holdB, nextServer, gamesA, gamesB + 1);

  const result = 1 + pi * restAfterWin + (1 - pi) * restAfterLoss;

  gamesMemo.set(key, result);
  return result;
}

/**
 * Réinitialise la mémoïsation de expectedRemainingGames.
 */
export function clearGamesMemo(): void {
  gamesMemo.clear();
}

// ---------------------------------------------------------------------------
// Sets restants attendus dans le match
// ---------------------------------------------------------------------------

/**
 * Nombre attendu de sets ENCORE JOUÉS jusqu'à la fin du match.
 *
 * Récursion DP sur (setsA, setsB) — même structure que matchWinProb :
 *   E(sA, sB) = 1 + p·E(sA+1, sB) + (1−p)·E(sA, sB+1)
 *
 * Exemples BO3 (p = 0.65) :
 *   E(2, 0)  = 0     (match terminé)
 *   E(1, 0)  = 1.35  (le set suivant est joué ; si le leader perd, un 3e suit)
 *   E(0, 0)  ≈ 2.46
 *
 * @param setsA - Sets gagnés par A
 * @param setsB - Sets gagnés par B
 * @param pWinSetA - Probabilité que A gagne le prochain set
 * @param bo3 - true si best-of-3, false si best-of-5
 * @returns Nombre espéré de sets restant à jouer (≥ 0)
 */
export function expectedRemainingSets(
  setsA: number,
  setsB: number,
  pWinSetA: number,
  bo3: boolean = true
): number {
  const setsToWin = bo3 ? 2 : 3;

  // Match terminé → plus aucun set à jouer.
  if (setsA >= setsToWin || setsB >= setsToWin) {
    return 0;
  }

  return (
    1 +
    pWinSetA * expectedRemainingSets(setsA + 1, setsB, pWinSetA, bo3) +
    (1 - pWinSetA) * expectedRemainingSets(setsA, setsB + 1, pWinSetA, bo3)
  );
}

// ---------------------------------------------------------------------------
// Probabilité de victoire dans le match (best-of-3 ou best-of-5)
// ---------------------------------------------------------------------------

/**
 * Probabilité que A gagne le match en utilisant la récursion Markov
 * sur les sets.
 *
 * @param pWinSetA - Probabilité que A gagne un set donné
 * @param bo3 - true si best-of-3, false si best-of-5
 * @returns Probabilité que A gagne le match (0-1)
 */
export function matchWinProb(pWinSetA: number, bo3: boolean = true): number {
  const setsToWin = bo3 ? 2 : 3;

  // DP sur les états (sA, sB)
  const memo = new Map<string, number>();

  function dp(sA: number, sB: number): number {
    if (sA >= setsToWin) return 1;
    if (sB >= setsToWin) return 0;

    const key = `${sA},${sB}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const result = pWinSetA * dp(sA + 1, sB) + (1 - pWinSetA) * dp(sA, sB + 1);
    memo.set(key, result);
    return result;
  }

  return dp(0, 0);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Score exact de set
// ---------------------------------------------------------------------------

/**
 * Probabilité d'un score exact de match en sets (ex: 2-0, 2-1, 0-2, 1-2).
 *
 * DP sur les états (setsA, setsB) avec pWinSetA constant.
 *
 * @param holdA - Hold de A (gameWinProb(pServeA))
 * @param holdB - Hold de B (gameWinProb(pServeB))
 * @param targetA - Sets finaux pour A (ex: 2)
 * @param targetB - Sets finaux pour B (ex: 0)
 * @param bo3 - true si best-of-3
 * @returns Probabilité du score exact (0-1)
 */
export function setScoreExact(
  holdA: number,
  holdB: number,
  targetA: number,
  targetB: number,
  bo3: boolean = true
): number {
  const setsToWin = bo3 ? 2 : 3;

  // Validation : un joueur doit atteindre setsToWin, l'autre < setsToWin
  if (targetA < 0 || targetB < 0) return 0;
  if (targetA > setsToWin || targetB > setsToWin) return 0;
  if (Math.max(targetA, targetB) !== setsToWin) return 0;
  if (targetA === setsToWin && targetB === setsToWin) return 0;

  // Calculer P(A gagne un set) via Markov
  clearSetWinMemo();
  const pWinSetA = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // DP
  const memo = new Map<string, number>();

  function dp(sA: number, sB: number): number {
    if (sA === targetA && sB === targetB) return 1;
    if (sA > targetA || sB > targetB) return 0;
    if (sA >= setsToWin || sB >= setsToWin) return 0;

    const key = `${sA},${sB}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const result = pWinSetA * dp(sA + 1, sB) + (1 - pWinSetA) * dp(sA, sB + 1);
    memo.set(key, result);
    return result;
  }

  return dp(0, 0);
}

// ---------------------------------------------------------------------------
// Handicap de sets
// ---------------------------------------------------------------------------

/**
 * Probabilité que A gagne avec un handicap de sets donné.
 *
 * Convention 1xBet : handicap = -1.5 signifie que A donne 1.5 sets.
 *   → A doit gagner 2-0 (BO3) pour couvrir.
 *   → A doit gagner 3-0 ou 3-1 (BO5) pour couvrir.
 *
 * @param holdA - Hold de A
 * @param holdB - Hold de B
 * @param handicap - Handicap (négatif = favori donne)
 * @param bo3 - true si best-of-3
 * @returns Probabilité que A couvre le handicap (0-1)
 */
export function setHandicap(
  holdA: number,
  holdB: number,
  handicap: number,
  bo3: boolean = true
): number {
  const setsToWin = bo3 ? 2 : 3;

  // Calculer P(A gagne un set) via Markov
  clearSetWinMemo();
  const pWinSetA = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // DP
  const memo = new Map<string, number>();

  function dp(sA: number, sB: number): number {
    // Match terminé
    if (sA >= setsToWin) {
      const diff = sA - sB;
      return diff + handicap > 0 ? 1 : 0;
    }
    if (sB >= setsToWin) {
      const diff = sA - sB;
      return diff + handicap > 0 ? 1 : 0;
    }

    const key = `${sA},${sB}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const result = pWinSetA * dp(sA + 1, sB) + (1 - pWinSetA) * dp(sA, sB + 1);
    memo.set(key, result);
    return result;
  }

  return dp(0, 0);
}

// ---------------------------------------------------------------------------
// Handicap de jeux (résultat attendu)
// ---------------------------------------------------------------------------

/**
 * Handicap théorique en jeux basé sur le gap de hold.
 *
 * Calcule le nombre attendu de jeux gagnés par A minus B.
 * Convention bookmaker : négatif = A est favori (donne des jeux).
 *
 * @param holdA - Hold de A
 * @param holdB - Hold de B
 * @param pWinSetA - P(A gagne un set)
 * @param bo3 - true si best-of-3
 * @returns Handicap en jeux (négatif = favori A)
 */
export function gameHandicap(
  holdA: number,
  holdB: number,
  pWinSetA: number,
  bo3: boolean = true
): number {
  const expectedSets = expectedRemainingSets(0, 0, pWinSetA, bo3);

  // A gagne ~(holdA × 4.5) jeux par set au service
  // B gagne ~(holdB × 4.5) jeux par set au service
  // Convention : négatif = A donne des jeux (favori)
  const deltaPerSet = (holdA - holdB) * 4.5 * 2;
  return -deltaPerSet * expectedSets;
}

// ---------------------------------------------------------------------------
// Double résultat (1er set + match)
// ---------------------------------------------------------------------------

/**
 * Probabilité que A gagne le 1er set ET le match.
 *
 * @param holdA - Hold de A
 * @param holdB - Hold de B
 * @param bo3 - true si best-of-3
 * @returns Probabilités du double résultat (0-1)
 */
export function doubleResult(
  holdA: number,
  holdB: number,
  bo3: boolean = true
): { aWins1stAndMatch: number; bWins1stAndMatch: number; aWins1stLosesMatch: number; bWins1stLosesMatch: number } {
  // P(A gagne set1) via Markov set
  clearSetWinMemo();
  const pASet1 = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // P(A gagne match | A mène 1-0)
  const pAMatchGiven10 = matchWinProbFromState(1, 0, pASet1, bo3);

  // P(B gagne set1)
  const pBSet1 = 1 - pASet1;

  // P(A gagne match | A mène 0-1)
  const pAMatchGiven01 = matchWinProbFromState(0, 1, pASet1, bo3);

  return {
    aWins1stAndMatch: pASet1 * pAMatchGiven10,
    bWins1stAndMatch: pBSet1 * (1 - pAMatchGiven01),
    aWins1stLosesMatch: pASet1 * (1 - pAMatchGiven10),
    bWins1stLosesMatch: pBSet1 * pAMatchGiven01,
  };
}

/**
 * P(A gagne match) depuis un état (sA, sB) avec pWinSetA constant.
 */
function matchWinProbFromState(
  sA: number,
  sB: number,
  pWinSetA: number,
  bo3: boolean
): number {
  const setsToWin = bo3 ? 2 : 3;
  const memo = new Map<string, number>();

  function dp(a: number, b: number): number {
    if (a >= setsToWin) return 1;
    if (b >= setsToWin) return 0;
    const key = `${a},${b}`;
    const c = memo.get(key);
    if (c !== undefined) return c;
    const r = pWinSetA * dp(a + 1, b) + (1 - pWinSetA) * dp(a, b + 1);
    memo.set(key, r);
    return r;
  }

  return dp(sA, sB);
}

// ---------------------------------------------------------------------------
// T3 : Marchés Premier Set
// ---------------------------------------------------------------------------

/**
 * Probabilité que A gagne le premier set.
 *
 * Wrapper sur setWinProb avec état initial (0-0, set 1, A sert).
 *
 * @param holdA - Hold de A
 * @param holdB - Hold de B
 * @returns Probabilité que A gagne le 1er set (0-1)
 */
export function firstSetWinner(holdA: number, holdB: number): number {
  clearSetWinMemo();
  return setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");
}

/**
 * Nombre attendu de jeux dans le premier set.
 *
 * Wrapper sur expectedRemainingGames avec état initial (0-0).
 *
 * @param holdA - Hold de A
 * @param holdB - Hold de B
 * @returns Espérance du nombre de jeux dans le 1er set
 */
export function firstSetTotal(holdA: number, holdB: number): number {
  clearGamesMemo();
  return expectedRemainingGames(holdA, holdB, "A", 0, 0);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/**
 * Réinitialise toutes les mémoïsations.
 * À appeler entre deux matchs pour éviter les fuites de mémoire.
 */
export function clearAllMemos(): void {
  clearSetWinMemo();
  clearDistMemo();
  clearGamesMemo();
}

/**
 * Calcule le hold de chaque joueur à partir de leurs probabilités
 * de points au service.
 *
 * @param pServeA - P(A gagne un point au service)
 * @param pServeB - P(B gagne un point au service)
 * @returns [holdA, holdB] - Probabilités de tenir le service
 */
export function computeHolds(
  pServeA: number,
  pServeB: number
): [number, number] {
  return [gameWinProb(pServeA), gameWinProb(pServeB)];
}

// ---------------------------------------------------------------------------
// Markov point-level — P(gagner le jeu) depuis un score de points
// ---------------------------------------------------------------------------

/**
 * P(A gagne le jeu EN COURS) depuis l'état de points (Markov point-level).
 *
 * Primitive "sensibilité au point" : balle de break, 30-30, avantage…
 * Le serveur est constant au sein du jeu (alternance par JEU, pas par point).
 * Deuce et avantages résolus en forme fermée (évite la récursion infinie
 * 40-40 ↔ Av.-40) — même modèle que gameWinProb, d'où la cohérence
 * gameWinProbFromScore(0,0,"A",p,·) === gameWinProb(p).
 *
 * NB: ne PAS utiliser pour un tie-break (cible 7 points, alternance
 * par 2 points) — l'appelant doit exclure l'état 6-6.
 *
 * @param ptsA - Points bruts de A dans le jeu (0=0, 1=15, 2=30, 3=40, 4=Av.)
 * @param ptsB - Points bruts de B
 * @param server - Joueur au service pour CE jeu
 * @param pServeA - P(A gagne un point au service)
 * @param pServeB - P(B gagne un point au service)
 * @returns P(A gagne le jeu) [0..1]
 */
export function gameWinProbFromScore(
  ptsA: number,
  ptsB: number,
  server: Player,
  pServeA: number,
  pServeB: number
): number {
  // Terminaux défensifs (le feed ne devrait jamais les produire).
  if (ptsA >= 4 && ptsA - ptsB >= 2) return 1;
  if (ptsB >= 4 && ptsB - ptsA >= 2) return 0;

  // P(A gagne le prochain point) : au service → pServe, au retour → break.
  const pPointA = server === "A" ? pServeA : 1 - pServeB;

  // Zone deuce/avantage (40-40 et au-delà) : forme fermée.
  if (ptsA >= 3 && ptsB >= 3) {
    const p2 = pPointA * pPointA;
    const q2 = (1 - pPointA) * (1 - pPointA);
    const pDeuce = p2 / (p2 + q2); // P(gagner) depuis 40-40
    if (ptsA === ptsB) return pDeuce;
    if (ptsA > ptsB) return pPointA + (1 - pPointA) * pDeuce; // Av. A
    return pPointA * pDeuce; // Av. B : point gagné puis deuce
  }

  // Zone pré-deuce (≤ 16 états, récursion bornée).
  const win = gameWinProbFromScore(ptsA + 1, ptsB, server, pServeA, pServeB);
  const loss = gameWinProbFromScore(ptsA, ptsB + 1, server, pServeA, pServeB);
  return pPointA * win + (1 - pPointA) * loss;
}

/**
 * Mélange la force de service prematch avec la force observée ce match,
 * pondérée par récence : w = gamesPlayed / (gamesPlayed + demiVie).
 *
 * w = 0 au début (prematch dominant) → w → 1 en fin de match
 * (le service OBSERVÉ prend le pas sur l'estimation initiale).
 * C'est la traduction minimaliste du leitmotiv Hawk-Eye : plus on
 * avance dans le match, plus la donnée récente compte.
 *
 * @param pServePrematch - P(point service) estimé prematch
 * @param pServeObserved - P(point service) observé ce match [0..1], null si indisponible
 * @param gamesPlayed - Jeux déjà joués dans le match
 * @param halfLifeGames - Jeux nécessaires pour atteindre un poids de 50% (défaut 8)
 * @returns P(point service) pondérée par récence
 */
export function blendServeRecent(
  pServePrematch: number,
  pServeObserved: number | null | undefined,
  gamesPlayed: number,
  halfLifeGames: number = 8
): number {
  if (pServeObserved == null) return pServePrematch;
  const w = gamesPlayed / (gamesPlayed + halfLifeGames);
  return pServePrematch * (1 - w) + pServeObserved * w;
}
