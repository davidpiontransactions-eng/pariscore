/**
 * Live Matrix — reproduction du "Live score & matrix" Betfair Tennis Trader
 * (Peter Webb, betfairtradingblog.com).
 *
 * Grille des scores de points du jeu EN COURS : pour chaque état de points
 * (0, 15, 30, 40 — le coin 40-40 sert aussi de deuce), on calcule :
 *   - P(jeu)   : P(A gagne le jeu) depuis cet état (Markov point-level)
 *   - P(set)   : P(A gagne le set en cours), le jeu courant déroulé un niveau
 *   - P(match) : P(A gagne le match), DP sur les sets restants
 * Chaque P(match) se convertit en cote juste (1/p) → la matrice prédit où
 * les cotes live (1xBet…) vont dériver selon le prochain point gagné/perdu.
 *
 * Pur et synchrone : recalculable à chaque poll (les mémoïsations internes
 * de live-markov sont réinitialisées en tête de buildLiveMatrix).
 */

import {
  setWinProb,
  gameWinProb,
  gameWinProbFromScore,
  clearAllMemos,
} from "./live-markov";

/** Cellule de la matrice = un état de points du jeu courant. */
export type LiveMatrixCell = {
  /** Points bruts de A (0..3 ; 3 = 40, coin (3,3) = 40-40/deuce). */
  ptsA: number;
  /** Points bruts de B. */
  ptsB: number;
  /** P(A gagne le JEU) depuis cet état [0..1]. */
  pGameA: number;
  /** P(A gagne le SET en cours) depuis cet état [0..1]. */
  pSetA: number;
  /** P(A gagne le MATCH) depuis cet état [0..1]. */
  pMatchA: number;
  /** Cote juste A (1/pMatchA), plafonnée à 999. */
  fairOddA: number;
  /** Cote juste B (1/(1-pMatchA)), plafonnée à 999. */
  fairOddB: number;
};

/** Modèle complet consommé par le composant d'affichage. */
export type LiveMatrixModel = {
  /** Grille 4×4 : cells[ptsA][ptsB]. */
  cells: LiveMatrixCell[][];
  /** État courant (points clampés à la grille : Av → 3-3 géré par la forme deuce). */
  current: { ptsA: number; ptsB: number };
  /** Serveur du jeu courant. */
  server: "A" | "B";
  /** Score de jeux du set en cours. */
  games: [number, number];
  /** Sets gagnés. */
  sets: [number, number];
  /** Probas de point service utilisées (debug/affichage). */
  pServeA: number;
  pServeB: number;
  /** P(A gagne un set complet depuis 0-0) — utilisée pour les sets futurs. */
  pWinSetFresh: number;
  /** Best-of-3 ? */
  bo3: boolean;
};

/** Paramètres d'entrée de buildLiveMatrix. */
export type LiveMatrixInput = {
  /** P(A gagne un point au service) [0..1]. */
  pServeA: number;
  /** P(B gagne un point au service) [0..1]. */
  pServeB: number;
  /** Jeux du set en cours [A, B]. */
  games: [number, number];
  /** Sets gagnés [A, B]. */
  sets: [number, number];
  /** Points bruts du jeu en cours [A, B] (clampés à la grille). */
  points: [number, number];
  /** Serveur du jeu courant. */
  server: "A" | "B";
  /** Best-of-3 (défaut) ou best-of-5. */
  bo3?: boolean;
};

/** Taille de la grille : points 0..3 (0, 15, 30, 40). */
const GRID = 4;

/** Clamp un état de points vers la grille : Av./deuce → (3,3). */
function clampPoints(pts: number): number {
  return Math.max(0, Math.min(3, pts));
}

/**
 * Construit la matrice live complète.
 *
 * @param input — État du match + probas de service
 * @returns Modèle 4×4 prêt à l'affichage
 */
export function buildLiveMatrix(input: LiveMatrixInput): LiveMatrixModel {
  clearAllMemos();

  const { pServeA, pServeB, server, bo3 = true } = input;
  const [gA, gB] = input.games;
  const [sA, sB] = input.sets;
  const currentPtsA = clampPoints(input.points[0]);
  const currentPtsB = clampPoints(input.points[1]);
  const nextServer: "A" | "B" = server === "A" ? "B" : "A";

  // Holds (P tenir son service) depuis les probas de point.
  const holdA = gameWinProb(pServeA);
  const holdB = gameWinProb(pServeB);

  // P(A gagne un set complet depuis 0-0) — sert pour les sets FUTURS
  // (le set en cours, lui, est évalué depuis son état réel).
  const pWinSetFresh = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // P(A gagne le set en cours) si A gagne / perd le jeu courant.
  const setAfterWin = setWinProb(holdA, holdB, 0, 0, 1, gA + 1, gB, nextServer);
  const setAfterLoss = setWinProb(holdA, holdB, 0, 0, 1, gA, gB + 1, nextServer);

  // DP sur les sets restants : le set COURANT utilise l'état réel (mélange
  // win/loss du jeu courant), les sets futurs utilisent pWinSetFresh.
  const setsToWin = bo3 ? 2 : 3;
  const memo = new Map<string, number>();
  const dp = (sa: number, sb: number, pSetCurrent: number): number => {
    if (sa >= setsToWin) return 1;
    if (sb >= setsToWin) return 0;
    const key = `${sa},${sb}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const pThis =
      sa === sA && sb === sB ? pSetCurrent : pWinSetFresh;
    const r =
      pThis * dp(sa + 1, sb, pWinSetFresh) +
      (1 - pThis) * dp(sa, sb + 1, pWinSetFresh);
    memo.set(key, r);
    return r;
  };

  // Grille 4×4.
  const cells: LiveMatrixCell[][] = [];
  for (let i = 0; i < GRID; i++) {
    const row: LiveMatrixCell[] = [];
    for (let j = 0; j < GRID; j++) {
      // P(A gagne le jeu courant) depuis (i, j) — le serveur est constant
      // au sein du jeu.
      const pGameA = gameWinProbFromScore(i, j, server, pServeA, pServeB);

      // P(set en cours) : le jeu courant déroulé d'un niveau avec la vraie
      // proba issue de l'état de points.
      const pSetA = pGameA * setAfterWin + (1 - pGameA) * setAfterLoss;

      // P(match) : DP sets avec l'état réel pour le set courant.
      memo.clear();
      const pMatchA = dp(sA, sB, pSetA);

      const pB = Math.max(0.001, Math.min(0.999, 1 - pMatchA));
      row.push({
        ptsA: i,
        ptsB: j,
        pGameA,
        pSetA,
        pMatchA,
        fairOddA: pMatchA > 0.001 ? Math.min(999, 1 / pMatchA) : 999,
        fairOddB: pB > 0.001 ? Math.min(999, 1 / pB) : 999,
      });
    }
    cells.push(row);
  }

  return {
    cells,
    current: { ptsA: currentPtsA, ptsB: currentPtsB },
    server,
    games: [gA, gB],
    sets: [sA, sB],
    pServeA,
    pServeB,
    pWinSetFresh,
    bo3,
  };
}

/**
 * Détecte la side qui a une balle de break dans le jeu courant.
 * (Même logique que breakPointSide du live-score-announcer, adaptée ici
 * pour la matrice : renvoie "A" ou "B" ou null.)
 *
 * @param ptsA - Points bruts A
 * @param ptsB - Points bruts B
 * @param server - Serveur du jeu
 * @returns "A" si A (au retour) a une balle de break, "B" si c'est B, sinon null
 */
export function matrixBreakPointSide(
  ptsA: number,
  ptsB: number,
  server: "A" | "B"
): "A" | "B" | null {
  // A au retour → balle de break si A est à un point du jeu.
  if (server === "B") {
    if (ptsA >= 3 && ptsB <= 2) return "A";
    if (ptsA >= 3 && ptsB >= 3 && ptsA > ptsB) return "A"; // Av. A
    return null;
  }
  if (ptsB >= 3 && ptsA <= 2) return "B";
  if (ptsA >= 3 && ptsB >= 3 && ptsB > ptsA) return "B"; // Av. B
  return null;
}
