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
    const pi = serverNext === "A" ? holdA : holdB;
    const nextServer: Player = serverNext === "A" ? "B" : "A";

    // Si A gagne le point → gamesA + 1, si B gagne → gamesB + 1
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
  const pi = serverFirst === "A" ? holdA : holdB;
  const nextServer: Player = serverFirst === "A" ? "B" : "A";

  const distWinA = setScoreDistribution(holdA, holdB, nextServer, gamesA + 1, gamesB);
  const distWinB = setScoreDistribution(holdA, holdB, nextServer, gamesA, gamesB + 1);

  // Combiner les distributions
  for (const [score, prob] of Object.entries(distWinA)) {
    dist[score] = (dist[score] ?? 0) + pi * prob;
  }

  for (const [score, prob] of Object.entries(distWinB)) {
    dist[score] = (dist[score] ?? 0) + (1 - pi) * prob;
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

  const pi = serverFirst === "A" ? holdA : holdB;
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
