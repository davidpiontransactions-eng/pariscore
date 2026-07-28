/**
 * DR match "vrai" (ratio Sofascore-style) — calculé côté client depuis le
 * score live BSD (proxy games+sets).
 *
 * ⚠️ Approximation : le vrai DR Sofascore = (% points gagnés au retour) /
 * (% points perdus au service). Mais BSD /api/tennis/live ne fournit pas le
 * détail point-par-point dans LiveMatchState — seulement le score agrégé
 * (sets, games, points du jeu en cours).
 *
 * On utilise donc le PROXY games+sets du legacy (`_tnComputeDR` dans
 * pariscore.app.js:4176) :
 *
 *   DR_P1 = (gamesA + 6×setsWonA + 0.5) / (gamesB + 6×setsWonB + 0.5)
 *   DR_P2 = 1 / DR_P1
 *
 * Le `+0.5` (Laplace smoothing) évite la division par zéro au début du match
 * et stabilise les premières valeurs. C'est moins précis que le vrai DR
 * Sofascore (qui compte les points), mais c'est la MÊME formule que le legacy
 * → cohérent avec l'affichage historique de pariscore.app.js.
 *
 * Interprétation :
 *   DR = 1.00 → match parfaitement équilibré
 *   DR > 1.20 → P1 dominant (gagne nettement plus de jeux + sets)
 *   DR < 0.83 → P1 dominé (P2 dominant, car DR_P2 = 1/DR_P1 > 1.20)
 */

import type { LiveMatchState } from "@/hooks/use-live-matches";

export type DrMatchResult = {
  /** DR match de P1 (ratio > 0). 1.00 = équilibré, >1.20 dominant. */
  drA: number;
  /** DR match de P2 (= 1/drA). */
  drB: number;
  /** DR par set : un ratio par set COMPLÉTÉ + le set en cours.
   *  Index 0 = set 1, etc. null si pas encore joué. */
  drBySet: Array<{ drA: number; drB: number } | null>;
};

/** Laplace smoothing pour éviter division par 0 au début du match. */
const SMOOTH = 0.5;
/** Poids d'un set gagné en équivalent games (1 set ≈ 6 games de dominant). */
const SET_WEIGHT = 6;

/**
 * Calcule le DR ratio depuis un numérateur (jeux+sets×6) et un dénominateur.
 * Retourne {drA, drB} avec drB = 1/drA.
 */
function drRatio(numA: number, numB: number): { drA: number; drB: number } {
  const denom = numB + SMOOTH;
  if (denom <= 0) return { drA: 1, drB: 1 };
  const drA = (numA + SMOOTH) / denom;
  return { drA, drB: 1 / drA };
}

/**
 * @param liveState — État live du match (depuis useLiveMatches/useLiveStream).
 * @returns DR match + DR par set, ou null si pas encore live.
 */
export function computeDrMatch(liveState: LiveMatchState | undefined): DrMatchResult | null {
  if (!liveState) return null;

  const setsA = liveState.scoreA.sets;
  const setsB = liveState.scoreB.sets;
  const setsWonA = setsA.length;
  const setsWonB = setsB.length;

  // === DR match global (tous sets confondus + set en cours) ===
  // gamesA = somme des games des sets terminés + games du set en cours.
  const gamesSetsA = setsA.reduce((s, g) => s + g, 0);
  const gamesSetsB = setsB.reduce((s, g) => s + g, 0);
  const totalGamesA = gamesSetsA + liveState.scoreA.games;
  const totalGamesB = gamesSetsB + liveState.scoreB.games;
  const match = drRatio(
    totalGamesA + SET_WEIGHT * setsWonA,
    totalGamesB + SET_WEIGHT * setsWonB,
  );

  // === DR par set ===
  // Pour chaque set terminé : DR = (gamesA + 0.5) / (gamesB + 0.5) sans poids set
  // (un set terminé est déjà compté dans setsWon ci-dessus pour le global).
  // Pour le set en cours : on prend gamesA/gamesB actuels.
  const maxSets = Math.max(setsA.length, setsB.length, liveState.currentSet + 1);
  const drBySet: DrMatchResult["drBySet"] = [];
  for (let i = 0; i < maxSets; i++) {
    // Set en cours (index = currentSet) : on prend les games live.
    if (i === liveState.currentSet) {
      // N'afficher que si au moins un jeu joué dans le set (sinon DR = 1.0 bruité).
      if (liveState.scoreA.games + liveState.scoreB.games > 0) {
        drBySet[i] = drRatio(liveState.scoreA.games, liveState.scoreB.games);
      } else {
        drBySet[i] = null;
      }
    } else if (i < setsA.length && i < setsB.length) {
      // Set terminé : on a les games finaux dans setsA/setsB.
      const gA = setsA[i];
      const gB = setsB[i];
      // DR du set sans poids (les sets gagnés sont déjà implicitement pondérés
      // par le score final du set : 6-4 donne un DR set de 1.27, 6-2 donne 1.86).
      drBySet[i] = drRatio(gA, gB);
    } else {
      drBySet[i] = null;
    }
  }

  return {
    drA: match.drA,
    drB: match.drB,
    drBySet,
  };
}

/** Formate un DR ratio en chaîne courte : "1.14" (2 décimales). */
export function formatDr(dr: number): string {
  return dr.toFixed(2);
}

/**
 * Couleur sémantique pour un DR (utilisé pour les pastilles).
 *   >= 1.20 → vert (dominant)
 *   0.83-1.20 → neutre (équilibre)
 *   < 0.83 → rouge (dominé) — mais on affiche plutôt le DR de l'autre joueur
 */
export function drColorClass(dr: number): string {
  if (dr >= 1.2) return "text-emerald-300";
  if (dr <= 0.83) return "text-rose-300";
  return "text-muted-foreground/70";
}
