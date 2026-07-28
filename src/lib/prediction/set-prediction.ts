// Prédiction Markov "vainqueur du set" + "Over games set".
//
// Chaîne de Markov discrète sur les états (jeuxA, jeuxB) du set en cours.
// Réutilise `pHoldA/pHoldB` de Barnett-Clarke (total-games.ts) — pas de
// recalcul de base.
//
// États absorbants :
//   - Set gagné par A : jeuxA >= 6 ET jeuxA - jeuxB >= 2
//   - Set gagné par B : symétrique
//   - Tiebreak à 6-6 : markov point-par-point (premier à 7, gagne par 2)
//
// Serveur déduit de la parité (jeuxA + jeuxB) — convention ATP/WTA : A a
// servi en premier dans le set. On ignore les exceptions rares (choix
// alternatif du serveur en début de set) qui nécessiteraient l'historique.
//
// VALIDATION (cas tests, voir commit/prototype) :
//   6-0 A           → P(A win) = 1.00 ✓
//   0-0 pHold égaux → P(A win) ≈ 0.51 (léger avantage au 1er serveur) ✓
//   5-0 A           → P(A win) ≈ 0.99 ✓
//   A fort (0.85/0.70) → P(A win) ≈ 0.78 ✓
//
// Coût : O(états) ≈ O(50) par set — fermé, utilisable en live (recalcul SSE).

import { computePHold } from "@/lib/prediction/total-games";

export type SetPredictionInput = {
  /** Jeux de A dans le set en cours (0-6). */
  gamesA: number;
  /** Jeux de B dans le set en cours (0-6). */
  gamesB: number;
  /** Probabilité de gain du jeu de service de A (forme fermée Barnett). */
  pHoldA: number;
  /** Probabilité de gain du jeu de service de B. */
  pHoldB: number;
};

export type SetGamesThreshold = 8.5 | 9.5 | 10.5;

export type SetPrediction = {
  /** P(A gagne le set) ∈ [0, 100]. */
  probAWinsSet: number;
  /** P(B gagne le set) ∈ [0, 100]. */
  probBWinsSet: number;
  /** P(total games du set > 8.5) ∈ [0, 100]. */
  over8_5: number;
  /** P(total games du set > 9.5) ∈ [0, 100]. */
  over9_5: number;
  /** P(total games du set > 10.5) ∈ [0, 100]. */
  over10_5: number;
  /** Seuil Over games set recommandé = le + value (proba la plus proche de 60%). */
  recommendedBet: {
    threshold: SetGamesThreshold;
    direction: "over" | "under";
    prob: number;
  };
};

/** Proba que A gagne le prochain jeu, selon le serveur. */
function probAWinsGame(
  server: "A" | "B",
  pHoldA: number,
  pHoldB: number,
): number {
  return server === "A" ? pHoldA : 1 - pHoldB;
}

/**
 * Proba que A gagne le tiebreak (premier à 7 points, gagne par 2).
 * A sert le 1er point du TB puis par paires alternées (séquence officielle).
 * Chaîne de Markov point-par-point avec memoization.
 */
function probAWinsTiebreak(pHoldA: number, pHoldB: number): number {
  const memo = new Map<string, number>();
  // Séquence officielle du TB : A sert au point d'index 0, puis on alterne par
  // paires : A sert aux index pairs de la paire, B aux impairs.
  // En pratique : serveur = A si floor(idx/2) est pair, sinon B.
  function p(ptsA: number, ptsB: number, idx: number): number {
    if (ptsA >= 7 && ptsA - ptsB >= 2) return 1;
    if (ptsB >= 7 && ptsB - ptsA >= 2) return 0;
    // Plafond anti-récursion infinie (TB rares au-delà de 12-12).
    if (idx > 30) return 0.5;

    const key = `${ptsA}-${ptsB}-${idx}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const pair = Math.floor(idx / 2);
    const server = pair % 2 === 0 ? "A" : "B";
    const pA = probAWinsGame(server, pHoldA, pHoldB);
    const result =
      pA * p(ptsA + 1, ptsB, idx + 1) + (1 - pA) * p(ptsA, ptsB + 1, idx + 1);
    memo.set(key, result);
    return result;
  }
  return p(0, 0, 0);
}

/**
 * P(A gagne le set) à partir du score courant. Récurrence avec memoization
 * sur (gamesA, gamesB). Serveur déduit de la parité (A sert en premier).
 */
function probAWinsSetFromScore(
  gamesA: number,
  gamesB: number,
  pHoldA: number,
  pHoldB: number,
): number {
  const memo = new Map<string, number>();
  function p(a: number, b: number): number {
    if (a >= 6 && a - b >= 2) return 1;
    if (b >= 6 && b - a >= 2) return 0;
    if (a === 6 && b === 6) return probAWinsTiebreak(pHoldA, pHoldB);

    const key = `${a}-${b}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const server: "A" | "B" = (a + b) % 2 === 0 ? "A" : "B";
    const pA = probAWinsGame(server, pHoldA, pHoldB);
    const result = pA * p(a + 1, b) + (1 - pA) * p(a, b + 1);
    memo.set(key, result);
    return result;
  }
  return p(gamesA, gamesB);
}

/**
 * Distribution du nombre TOTAL de games du set (à l'absorption).
 * DP itératif sur la grille (a,b) avec propagation des probas — comme une
 * chaîne absorbante classique. Retourne { [totalGames]: proba }.
 */
function setGamesDistribution(
  gamesA: number,
  gamesB: number,
  pHoldA: number,
  pHoldB: number,
): Record<number, number> {
  const key = (a: number, b: number) => `${a},${b}`;
  let current: Record<string, number> = { [key(gamesA, gamesB)]: 1 };
  const dist: Record<number, number> = {};

  let guard = 0;
  while (guard++ < 50) {
    const next: Record<string, number> = {};
    let any = false;

    for (const k in current) {
      const [aStr, bStr] = k.split(",");
      const a = +aStr;
      const b = +bStr;
      const prob = current[k];
      if (prob === 0) continue;

      // Absorbants → on ajoute la proba au total correspondant.
      if (a >= 6 && a - b >= 2) {
        dist[a + b] = (dist[a + b] || 0) + prob;
        continue;
      }
      if (b >= 6 && b - a >= 2) {
        dist[a + b] = (dist[a + b] || 0) + prob;
        continue;
      }
      if (a === 6 && b === 6) {
        dist[13] = (dist[13] || 0) + prob; // TB = 13 games
        continue;
      }

      // Non absorbant → propager vers (a+1,b) et (a,b+1).
      const server: "A" | "B" = (a + b) % 2 === 0 ? "A" : "B";
      const pA = probAWinsGame(server, pHoldA, pHoldB);
      const k1 = key(a + 1, b);
      next[k1] = (next[k1] || 0) + prob * pA;
      const k2 = key(a, b + 1);
      next[k2] = (next[k2] || 0) + prob * (1 - pA);
      any = true;
    }

    current = next;
    if (!any) break;
  }
  return dist;
}

/** P(total games du set > halfThreshold) à partir de la distribution. */
function probOverGames(
  dist: Record<number, number>,
  halfThreshold: number,
): number {
  let sum = 0;
  for (const n in dist) {
    if (+n > halfThreshold) sum += dist[n];
  }
  return sum;
}

/** Borne [0,1] → pourcentage entier [0,100]. */
function pct(x: number): number {
  return Math.round(Math.max(0, Math.min(1, x)) * 100);
}

/**
 * Prédiction set complète : proba vainqueur + Over games set.
 * @param input.gamesA/gamesB — score du set en cours
 * @param input.pHoldA/pHoldB — proba de gain du jeu de service (Barnett)
 */
export function predictSet(input: SetPredictionInput): SetPrediction {
  const { gamesA, gamesB, pHoldA, pHoldB } = input;

  const probAWin = probAWinsSetFromScore(gamesA, gamesB, pHoldA, pHoldB);
  const dist = setGamesDistribution(gamesA, gamesB, pHoldA, pHoldB);

  const over8_5 = probOverGames(dist, 8.5);
  const over9_5 = probOverGames(dist, 9.5);
  const over10_5 = probOverGames(dist, 10.5);

  // Reco = seuil dont la proba Over est la plus proche de 60% (le + "value",
  // ni trop évident ni trop risqué). Si toutes < 60%, on prend le plus élevé.
  const candidates: Array<{ threshold: SetGamesThreshold; prob: number }> = [
    { threshold: 8.5, prob: over8_5 },
    { threshold: 9.5, prob: over9_5 },
    { threshold: 10.5, prob: over10_5 },
  ];
  const best = candidates.reduce((best, c) => {
    const distToTarget = Math.abs(c.prob - 0.6);
    const bestDist = Math.abs(best.prob - 0.6);
    return distToTarget < bestDist ? c : best;
  }, candidates[0]);

  return {
    probAWinsSet: pct(probAWin),
    probBWinsSet: pct(1 - probAWin),
    over8_5: pct(over8_5),
    over9_5: pct(over9_5),
    over10_5: pct(over10_5),
    recommendedBet: {
      threshold: best.threshold,
      direction: "over",
      prob: pct(best.prob),
    },
  };
}

/**
 * Helper : résout pHoldA/pHoldB depuis pServe (stats serve) — wrapper pratique
 * pour les composants qui n'ont que les stats brutes, pas le pHold calculé.
 */
export function resolvePHold(pServeA: number, pServeB: number): {
  pHoldA: number;
  pHoldB: number;
} {
  return {
    pHoldA: computePHold(pServeA),
    pHoldB: computePHold(pServeB),
  };
}
