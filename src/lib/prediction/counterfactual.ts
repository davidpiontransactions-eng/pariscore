// Contrefactuels « et SI ? » — ce que devient la probabilité de match si le
// PROCHAIN jeu est remporté par A, ou s'il est breaké par B.
//
// POURQUOI
// --------
// Le widget affiche des probabilités qui bougent au score suivant. L'utilisateur
// doit deviner CE QU'IL PEUT FAIRE. Le contrefactuel rend la réactivité du
// moteur visible AVANT le changement de score : « si je gagne ce jeu, je passe
// à 38 % » est une information actionnable ; « 21 % » ne l'est pas.
//
// Il n'y a pas de simulation à écrire : `setWinProb` est déjà exactement la
// fonction « P(set | score de jeux, serveur, holds) ». Appeler le MÊME moteur
// avec gamesA+1, c'est la garantie que le contrefactuel et l'affichage ne
// peuvent pas diverger — pas de deuxième modèle à maintenir.
import { matchWinProbFromSets, setWinProb } from "@/lib/prediction/live-markov";

/** Identifiant du camp dans le moteur Markov. */
type Player = "A" | "B";

export type CounterfactualInput = {
  /** P(A gagne le SET en cours), dans [0, 1]. */
  setWinA: number;
  /** P(A tient son service) — probabilité de gain du jeu quand A sert. */
  holdA: number;
  /** P(B tient son service). */
  holdB: number;
  /** Sets DÉJÀ gagnés par A. */
  setsA: number;
  /** Sets DÉJÀ gagnés par B. */
  setsB: number;
  /** Jeux déjà gagnés dans le set EN COURS par A. */
  gamesA: number;
  /** Jeux déjà gagnés dans le set EN COURS par B. */
  gamesB: number;
  /** Qui sert au prochain jeu. */
  server: Player;
  /** true si le match se joue en best-of-3 (sinon best-of-5). */
  bo3?: boolean;
};

/** P(A gagne le match) depuis l'état donné. */
function matchProb(
  input: CounterfactualInput,
  gamesA: number,
  gamesB: number
): number {
  const pSet = setWinProb(
    input.holdA,
    input.holdB,
    input.setsA,
    input.setsB,
    input.setsA + input.setsB + 1,
    gamesA,
    gamesB,
    input.server
  );
  return matchWinProbFromSets(pSet, input.setsA, input.setsB, input.bo3 ?? true);
}

export type Counterfactual = {
  /** Libellé du camp qui joue le jeu (celui au service). */
  server: Player;
  /** P(A gagne le match) aujourd'hui. */
  nowA: number;
  /** P(A gagne le match) si A remporte le prochain jeu. */
  ifAWinsGame: number;
  /** P(A gagne le match) si B remporte le prochain jeu. */
  ifBWinsGame: number;
  /** Écart en points de pourcentage dû au gain du jeu par A. */
  swingIfA: number;
  /** Écart en points de pourcentage dû au gain du jeu par B. */
  swingIfB: number;
};

/**
 * Calcule les deux contrefactuels du prochain jeu.
 *
 * Un jeu : A le gagne s'il sert (holdA) ou s'il brise chez B (1 − holdB).
 * Symétrique pour B.
 *
 * @returns Les quatre probabilités, en fraction [0, 1].
 */
export function counterfactualNextGame(input: CounterfactualInput): Counterfactual {
  const nowA = matchProb(input, input.gamesA, input.gamesB);
  const aWins = matchProb(input, input.gamesA + 1, input.gamesB);
  const bWins = matchProb(input, input.gamesA, input.gamesB + 1);

  return {
    server: input.server,
    nowA,
    ifAWinsGame: aWins,
    ifBWinsGame: bWins,
    // Gain d'un point = ce que A récupère s'il prend le jeu.
    swingIfA: aWins - nowA,
    // B prend le jeu → A perd ce que le jeu valait.
    swingIfB: nowA - bWins,
  };
}