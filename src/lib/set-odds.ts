/**
 * Cotes (décimales) du vainqueur du set EN COURS — dérivées du modèle Markov.
 *
 * BSD ne fournit que les cotes MATCH (pas de cotes set). On dérive donc les
 * cotes set depuis le modèle Markov (probAWinsSet/probBWinsSet convertis en
 * cote décimale), avec un vig léger pour coller au réalisme bookmaker.
 *
 * Conversion proba → cote décimale :
 *   cote_juste = 1 / proba         (ex: proba 0.67 → cote 1.49)
 *   cote_bookmaker = cote_juste × (1 + vig)   (ex: 1.49 × 1.04 ≈ 1.55)
 *
 * Le vig de ~4% simule la marge bookmaker (sinon la somme des implied probs
 * ferait 1.00 exact = pari équitable, jamais vu en vrai).
 *
 * NB : comme le modèle Markov est réactif au break mais ignore la force globale
 * au début du set, on applique le MÊME mélange bayésien Markov+marché que le
 * pip-bet-panel.tsx (weightMarkov selon l'avancement du set) pour rester
 * cohérent avec les probas affichées dans le panneau 5 bets.
 */

import type { LiveMatchState } from "@/hooks/use-live-matches";
import {
  predictTotalGames,
  type PredictionSurface,
  type LiveGamesContext,
  type ServeStats,
} from "@/lib/prediction/total-games";
import { predictSet } from "@/lib/prediction/set-prediction";

/** Vig bookmaker simulé (~4% — marge marché typique tennis). */
const VIG = 0.04;

/** Mappe surface UI (FR) → surface modèle. */
function toModelSurface(s: string): PredictionSurface {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Construit le contexte live (cf. predictive-bets.ts:51). */
function buildLiveContext(state: LiveMatchState): LiveGamesContext {
  const completedSetsGames =
    state.scoreA.sets.reduce((a, b) => a + b, 0) +
    state.scoreB.sets.reduce((a, b) => a + b, 0);
  const currentSetGames = state.scoreA.games + state.scoreB.games;
  return {
    gamesPlayed: completedSetsGames + currentSetGames,
    setsWon: [state.scoreA.sets.length, state.scoreB.sets.length],
    currentSetGames: [state.scoreA.games, state.scoreB.games],
  };
}

/** Convertit une proba [0,1] en cote décimale bookmaker (avec vig). */
function probToOdd(prob: number): number {
  if (prob <= 0.01) return 50; // plafond défensif
  if (prob >= 0.99) return 1.01; // plancher défensif
  return (1 / prob) * (1 + VIG);
}

export type SetOdds = {
  /** Cote décimale du joueur A pour gagner le set en cours (avec vig). */
  oddsA: number;
  /** Cote décimale du joueur B pour gagner le set en cours (avec vig). */
  oddsB: number;
  /** Numéro du set en cours (1-based, pour affichage). */
  currentSetNumber: number;
};

/**
 * Calcule les cotes du vainqueur du set EN COURS.
 *
 * @param liveState — État live
 * @param serveStatsA/serveStatsB — Stats service/retour (pour Barnett pHold)
 * @param surface — Surface UI (FR) : "Dur" | "Terre battue" | "Gazon"
 * @param eloA/eloB — Elo joueurs (fallback si stats manquantes)
 * @returns null si pas live, ou si modèle indispo.
 */
export function computeSetOdds(
  liveState: LiveMatchState | undefined,
  serveStatsA: ServeStats | null | undefined,
  serveStatsB: ServeStats | null | undefined,
  surface: string,
  eloA?: number,
  eloB?: number,
): SetOdds | null {
  if (!liveState) return null;

  const modelSurface = toModelSurface(surface);
  const liveCtx = buildLiveContext(liveState);

  // 1. pHoldA/pHoldB via Barnett (résolu par predictTotalGames).
  const totalGames = predictTotalGames(
    serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null },
    serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null },
    modelSurface,
    3,
    eloA,
    eloB,
    liveCtx,
  );

  // 2. Markov set (proba vainqueur set en cours).
  const setPred = predictSet({
    gamesA: liveState.scoreA.games,
    gamesB: liveState.scoreB.games,
    pHoldA: totalGames.pHoldA,
    pHoldB: totalGames.pHoldB,
  });

  // 3. Mélange bayésien Markov + marché (cohérent avec pip-bet-panel.tsx:153).
  // Au début du set (0-0), on suit les cotes match ; plus le set avance, plus
  // le Markov (réactif au break) domine.
  const gamesA = liveState.scoreA.games;
  const gamesB = liveState.scoreB.games;
  const weightMarkov = Math.min(1, Math.max(0, (gamesA + gamesB) / 12));
  const weightMarket = 1 - weightMarkov;

  const markovA = setPred.probAWinsSet / 100; // [0,1]
  const markovB = setPred.probBWinsSet / 100;
  const marketA = liveState.liveProbA / 100;
  const marketB = liveState.liveProbB / 100;

  let blendedA = markovA * weightMarkov + marketA * weightMarket;
  let blendedB = markovB * weightMarkov + marketB * weightMarket;
  // Normalisation (les arrondis peuvent faire dériver la somme de 1).
  const total = blendedA + blendedB;
  if (total > 0) {
    blendedA /= total;
    blendedB /= total;
  }

  return {
    oddsA: probToOdd(blendedA),
    oddsB: probToOdd(blendedB),
    currentSetNumber: liveState.currentSet + 1,
  };
}
