/**
 * Modèle Tiebreak — formules fermées O'Malley (2008).
 *
 * Le tiebreak est un jeu alterné : A sert le 1er point, B sert le 2e,
 * puis alternance tous les 2 points. Premier à 7 points, avance de 2.
 *
 * Gestion du "deuce" (6-6+) via forme fermée : même structure que
 * le deuce dans un jeu normal.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Player = "A" | "B";

// ---------------------------------------------------------------------------
// Probabilité de gagner un tiebreak
// ---------------------------------------------------------------------------

/**
 * Probabilité que A gagne le tiebreak.
 *
 * Modèle Markov avec memo + forme fermée pour l'état deuce (≥6-6).
 *
 * @param pA - P(A gagne un point sur son service) [0-1]
 * @param pB - P(B gagne un point sur son service) [0-1]
 * @returns P(A gagne le tiebreak) [0-1]
 */
export function tiebreakProb(pA: number, pB: number): number {
  // pA = prob A gagne quand A sert
  // pB = prob B gagne quand B sert → A gagne avec prob (1-pB)
  const memo = new Map<string, number>();

  function dp(ptsA: number, ptsB: number, server: Player): number {
    // État terminal : A gagne (≥7, avance ≥2)
    if (ptsA >= 7 && ptsA - ptsB >= 2) return 1;
    // État terminal : B gagne
    if (ptsB >= 7 && ptsB - ptsA >= 2) return 0;

    // Deuce (≥6-6) : forme fermée pour éviter la récursion infinie
    if (ptsA >= 6 && ptsB >= 6) {
      return deuceProbTB(pA, pB, server);
    }

    const key = `${ptsA},${ptsB},${server}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const pWinPoint = server === "A" ? pA : 1 - pB;
    const nextServer: Player = server === "A" ? "B" : "A";

    const result =
      pWinPoint * dp(ptsA + 1, ptsB, nextServer) +
      (1 - pWinPoint) * dp(ptsA, ptsB + 1, nextServer);

    memo.set(key, result);
    return result;
  }

  return dp(0, 0, "A");
}

/**
 * Probabilité que A gagne depuis l'état deuce (≥6-6) dans un tiebreak.
 *
 * Forme fermée : P(deuce) = p² / (p² + q²)
 * où p = P(A gagne 2 points consécutifs avant B).
 *
 * Dans un TB, les points alternent : A sert, B sert, A sert, ...
 * Donc un "cycle" = 2 points.
 * P(A gagne cycle) = pA × (1-pB)  [A tient, B perd son service]
 * P(B gagne cycle) = (1-pA) × pB
 * P(deuce cycle) = 1 - P(A cycle) - P(B cycle)
 *
 * Depuis deuce : P(A gagne) = P(A cycle) / (P(A cycle) + P(B cycle))
 */
function deuceProbTB(pA: number, pB: number, _server: Player): number {
  const pACycle = pA * (1 - pB);  // A gagne les 2 points
  const pBCycle = (1 - pA) * pB;  // B gagne les 2 points
  const sum = pACycle + pBCycle;
  if (sum === 0) return 0.5; // cas dégénéré
  return pACycle / sum;
}

// ---------------------------------------------------------------------------
// Probabilité d'atteindre le tiebreak (6-6)
// ---------------------------------------------------------------------------

/**
 * Probabilité que le set atteigne un tiebreak (6-6).
 *
 * @param holdA - P(A tient son service)
 * @param holdB - P(B tient son service)
 * @returns P(set va en tiebreak) [0-1]
 */
export function tiebreakSet(holdA: number, holdB: number): number {
  const memo = new Map<string, number>();

  function dp(gA: number, gB: number, server: Player): number {
    if (gA === 6 && gB === 6) return 1;
    if (gA >= 6 && gA - gB >= 2) return 0;
    if (gB >= 6 && gB - gA >= 2) return 0;

    const key = `${gA},${gB},${server}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const pAGame = server === "A" ? holdA : 1 - holdB;
    const nextServer: Player = server === "A" ? "B" : "A";

    const result =
      pAGame * dp(gA + 1, gB, nextServer) +
      (1 - pAGame) * dp(gA, gB + 1, nextServer);

    memo.set(key, result);
    return result;
  }

  return dp(0, 0, "A");
}

/**
 * Probabilité que A gagne le set via tiebreak.
 *
 * P(A gagne set par TB) = P(6-6) × P(A gagne TB | 6-6)
 */
export function tiebreakWinner(holdA: number, holdB: number): number {
  const pReachTB = tiebreakSet(holdA, holdB);
  const pWinTB = tiebreakProb(holdA, holdB);
  return pReachTB * pWinTB;
}

// ---------------------------------------------------------------------------
// Distribution des scores de tiebreak
// ---------------------------------------------------------------------------

/**
 * Distribution des scores de tiebreak (BFS probabiliste, tronqué à 20 points).
 */
export function tiebreakScoreDistribution(pA: number, pB: number): Record<string, number> {
  const dist: Record<string, number> = {};

  // BFS avec accumulation de probabilité
  // Map: clé état → probabilité accumulée
  let current = new Map<string, { ptsA: number; ptsB: number; server: Player; prob: number }>();
  current.set("0,0,A", { ptsA: 0, ptsB: 0, server: "A", prob: 1 });

  for (let depth = 0; depth < 40; depth++) {
    const next = new Map<string, { ptsA: number; ptsB: number; server: Player; prob: number }>();

    for (const state of current.values()) {
      const { ptsA, ptsB, server, prob } = state;
      if (prob < 1e-12) continue;

      // Terminal A wins
      if (ptsA >= 7 && ptsA - ptsB >= 2) {
        const score = `${ptsA}-${ptsB}`;
        dist[score] = (dist[score] ?? 0) + prob;
        continue;
      }
      // Terminal B wins
      if (ptsB >= 7 && ptsB - ptsA >= 2) {
        const score = `${ptsA}-${ptsB}`;
        dist[score] = (dist[score] ?? 0) + prob;
        continue;
      }

      const pWinPoint = server === "A" ? pA : 1 - pB;
      const nextServer: Player = server === "A" ? "B" : "A";

      // A gagne le point
      const keyA = `${ptsA + 1},${ptsB},${nextServer}`;
      const existingA = next.get(keyA);
      next.set(keyA, {
        ptsA: ptsA + 1, ptsB, server: nextServer,
        prob: (existingA?.prob ?? 0) + prob * pWinPoint
      });

      // B gagne le point
      const keyB = `${ptsA},${ptsB + 1},${nextServer}`;
      const existingB = next.get(keyB);
      next.set(keyB, {
        ptsA, ptsB: ptsB + 1, server: nextServer,
        prob: (existingB?.prob ?? 0) + prob * (1 - pWinPoint)
      });
    }

    current = next;
    if (current.size === 0) break;
  }

  return dist;
}
