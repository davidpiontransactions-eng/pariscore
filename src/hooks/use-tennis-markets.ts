"use client";

// useTennisMarkets — hook live pour marchés tennis.
//
// Combine les modèles Markov/Poisson avec les probabilités implicites marché
// via le blend bayésien. Poll toutes les8 secondes.

import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { gameWinProb, setWinProb, setScoreExact, setHandicap, gameHandicap, doubleResult, firstSetWinner, firstSetTotal, clearAllMemos } from "@/lib/prediction/live-markov";
import { probOver, playerTotalGames, totalSets, straightSets, atLeastOneSet } from "@/lib/prediction/total-games";
import { totalAcesO_U, acesPerSet } from "@/lib/prediction/most-aces";
import { tiebreakSet } from "@/lib/prediction/tiebreak";
import { bayesianBlend, deVig, oddToProb, computeEdge, kellyFraction } from "@/lib/prediction/live-blend";

type MarketResult = {
  id: string;
  label: string;
  category: string;
  probA: number;
  probB: number;
  edge?: number;
  kelly?: number;
  recommended: boolean;
};

type UseTennisMarketsResult = {
  markets: MarketResult[];
  loading: boolean;
  error: string | null;
  matchProgress: number;
  modelWeight: number;
  marketWeight: number;
  dominant: "model" | "market" | "balanced";
  lastUpdate: Date | null;
};

/** Calcule la progression du match [0-1]. */
function computeMatchProgress(state: LiveMatchState): number {
  const setsPlayed = state.scoreA.sets.length;
  const gamesInCurrentSet = state.scoreA.games + state.scoreB.games;
  // BO3 : max3 sets, ~10 jeux par set
  const progress = (setsPlayed * 10 + gamesInCurrentSet) / 30;
  return Math.min(1, Math.max(0, progress));
}

/** Calcule les marchés depuis l'état live. */
function computeMarketsFromLive(
  state: LiveMatchState,
  pServeA: number,
  pServeB: number,
): { markets: MarketResult[]; blend: { modelWeight: number; marketWeight: number; dominant: "model" | "market" | "balanced" } } {
  clearAllMemos();

  const holdA = gameWinProb(pServeA);
  const holdB = gameWinProb(pServeB);
  const progress = computeMatchProgress(state);

  // P(A gagne un set) via Markov
  const pWinSetA = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // Probabilités marché (depuis les cotes live)
  let marketProbA = state.liveProbA / 100;
  if (state.oddsA && state.oddsB) {
    const [deVigA] = deVig([oddToProb(state.oddsA), oddToProb(state.oddsB)]);
    marketProbA = deVigA;
  }

  // Blend bayésien
  const blend = bayesianBlend({
    matchProgress: progress,
    modelProb: pWinSetA,
    modelConfidence: 0.8,
    marketProb: marketProbA,
    marketConfidence: 0.9,
  });

  const markets: MarketResult[] = [];

  // Cotes live (si disponibles)
  const oddsA = state.oddsA;
  const oddsB = state.oddsB;

  // Helper
  function addMarket(id: string, label: string, category: string, probA: number, probB: number) {
    const maxProb = Math.max(probA, probB);
    const recommended = Math.abs(maxProb * 100 - 60) < 10;

    // Edge vs marché (si cotes disponibles)
    let edge: number | undefined;
    let kelly: number | undefined;
    if (oddsA && oddsB) {
      const [marketProbA] = deVig([oddToProb(oddsA), oddToProb(oddsB)]);
      edge = computeEdge(probA, marketProbA);
      kelly = kellyFraction(probA, oddsA);
    }

    markets.push({
      id,
      label,
      category,
      probA: Math.round(probA * 10000) / 100,
      probB: Math.round(probB * 10000) / 100,
      edge: edge !== undefined ? Math.round(edge * 100) / 100 : undefined,
      kelly: kelly !== undefined ? Math.round(kelly * 10000) / 100 : undefined,
      recommended,
    });
  }

  // --- Set Score (4 combinaisons BO3) ---
  clearAllMemos();
  addMarket("correct-score-2-0", "Score exact 2-0", "set-score", setScoreExact(holdA, holdB, 2, 0, true), 0);
  clearAllMemos();
  addMarket("correct-score-2-1", "Score exact 2-1", "set-score", setScoreExact(holdA, holdB, 2, 1, true), 0);
  clearAllMemos();
  addMarket("correct-score-0-2", "Score exact 0-2", "set-score", 0, setScoreExact(holdA, holdB, 0, 2, true));
  clearAllMemos();
  addMarket("correct-score-1-2", "Score exact 1-2", "set-score", 0, setScoreExact(holdA, holdB, 1, 2, true));

  // --- Set Handicap ---
  clearAllMemos();
  addMarket("set-handicap-1.5", "Handicap sets -1.5", "set-handicap", setHandicap(holdA, holdB, -1.5, true), 0);
  clearAllMemos();
  addMarket("set-handicap+1.5", "Handicap sets +1.5", "set-handicap", setHandicap(holdA, holdB, 1.5, true), 0);

  // --- Game Handicap ---
  clearAllMemos();
  const gameH = gameHandicap(holdA, holdB, pWinSetA, true);
  // Simuler P(A couvre handicap) via approximation
  const gh25 = gameH < -2.5 ? 0.65 : 0.35;
  const gh45 = gameH < -4.5 ? 0.60 : 0.40;
  addMarket("game-handicap-2.5", "Handicap jeux -2.5", "game-handicap", gh25, 1 - gh25);
  addMarket("game-handicap+2.5", "Handicap jeux +2.5", "game-handicap", 1 - gh25, gh25);
  addMarket("game-handicap-4.5", "Handicap jeux -4.5", "game-handicap", gh45, 1 - gh45);
  addMarket("game-handicap+4.5", "Handicap jeux +4.5", "game-handicap", 1 - gh45, gh45);

  // --- Total Games (6 seuils) ---
  const lambda = 9.5 * 2.1;
  for (const threshold of [18.5, 19.5, 20.5, 21.5, 22.5, 23.5]) {
    const over = probOver(threshold, lambda);
    addMarket(`total-over-${threshold}`, `Total Over ${threshold}`, "total-games", over, 1 - over);
    addMarket(`total-under-${threshold}`, `Total Under ${threshold}`, "total-games", 1 - over, over);
  }

  // --- Player Total Games ---
  const ptg = playerTotalGames(holdA, holdB, pWinSetA, 3);
  addMarket("player-a-over-12.5", "A Over 12.5 jeux", "total-games", ptg.gamesA > 12.5 ? 0.6 : 0.4, ptg.gamesA > 12.5 ? 0.4 : 0.6);
  addMarket("player-b-over-12.5", "B Over 12.5 jeux", "total-games", ptg.gamesB > 12.5 ? 0.4 : 0.6, ptg.gamesB > 12.5 ? 0.6 : 0.4);

  // --- Total Sets ---
  const ts = totalSets(pWinSetA, 3);
  addMarket("total-sets-2", "Total sets = 2", "total-games", ts < 2.5 ? 0.65 : 0.35, ts < 2.5 ? 0.35 : 0.65);
  addMarket("total-sets-3", "Total sets = 3", "total-games", ts > 2.5 ? 0.60 : 0.40, ts > 2.5 ? 0.40 : 0.60);

  // --- Straight Sets ---
  const ss = straightSets(pWinSetA, 3);
  addMarket("straight-sets-a", "A gagne 2-0", "set-score", ss.aWins, 0);
  addMarket("straight-sets-b", "B gagne 2-0", "set-score", 0, ss.bWins);

  // --- At Least One Set ---
  const als = atLeastOneSet(pWinSetA, 3);
  addMarket("at-least-one-set-a", "A gagne ≥1 set", "set-score", als.aWinsAtLeast1, 1 - als.aWinsAtLeast1);
  addMarket("at-least-one-set-b", "B gagne ≥1 set", "set-score", als.bWinsAtLeast1, 1 - als.bWinsAtLeast1);

  // --- Aces (3 seuils) ---
  for (const threshold of [9.5, 12.5, 15.5]) {
    const over = totalAcesO_U(threshold, 4, 4);
    addMarket(`aces-over-${threshold}`, `Total aces Over ${threshold}`, "aces", over, 1 - over);
    addMarket(`aces-under-${threshold}`, `Total aces Under ${threshold}`, "aces", 1 - over, over);
  }

  // --- Tiebreak ---
  clearAllMemos();
  const pTB = tiebreakSet(holdA, holdB);
  addMarket("tiebreak-yes", "Tiebreak dans le match", "tiebreak", pTB, 1 - pTB);
  addMarket("tiebreak-no", "Pas de tiebreak", "tiebreak", 1 - pTB, pTB);

  // --- First Set ---
  clearAllMemos();
  const pFirst = firstSetWinner(holdA, holdB);
  addMarket("first-set-winner-a", "1er set : A", "first-set", pFirst, 1 - pFirst);
  addMarket("first-set-winner-b", "1er set : B", "first-set", 1 - pFirst, pFirst);

  // --- First Set Total Games ---
  clearAllMemos();
  const fst = firstSetTotal(holdA, holdB);
  addMarket("first-set-over-9.5", "1er set Over 9.5", "first-set", fst > 9.5 ? 0.6 : 0.4, fst > 9.5 ? 0.4 : 0.6);

  // --- Double Result ---
  clearAllMemos();
  const dr = doubleResult(holdA, holdB, true);
  addMarket("double-a-a", "A gagne 1er set + match", "double-result", dr.aWins1stAndMatch, dr.bWins1stAndMatch);
  addMarket("double-b-b", "B gagne 1er set + match", "double-result", dr.bWins1stAndMatch, dr.aWins1stAndMatch);
  addMarket("double-a-b", "A 1er set, B match", "double-result", dr.aWins1stLosesMatch, dr.bWins1stLosesMatch);
  addMarket("double-b-a", "B 1er set, A match", "double-result", dr.bWins1stLosesMatch, dr.aWins1stLosesMatch);

  return {
    markets,
    blend: {
      modelWeight: blend.modelWeight,
      marketWeight: blend.marketWeight,
      dominant: blend.dominant,
    },
  };
}

/**
 * Hook live pour marchés tennis.
 *
 * @param liveState - État live du match (depuis use-live-matches)
 * @param pServeA - P(A gagne un point au service) — défaut0.67
 * @param pServeB - P(B gagne un point au service) — défaut0.62
 */
export function useTennisMarkets(
  liveState: LiveMatchState | null | undefined,
  pServeA: number = 0.67,
  pServeB: number = 0.62,
): UseTennisMarketsResult {
  const [markets, setMarkets] = useState<MarketResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchProgress, setMatchProgress] = useState(0);
  const [modelWeight, setModelWeight] = useState(0.5);
  const [marketWeight, setMarketWeight] = useState(0.5);
  const [dominant, setDominant] = useState<"model" | "market" | "balanced">("balanced");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Recalculer quand liveState change
  useEffect(() => {
    if (!liveState || !liveState.isLive) {
      setMarkets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = computeMarketsFromLive(liveState, pServeA, pServeB);
      setMarkets(result.markets);
      setMatchProgress(computeMatchProgress(liveState));
      setModelWeight(result.blend.modelWeight);
      setMarketWeight(result.blend.marketWeight);
      setDominant(result.blend.dominant);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de calcul");
    } finally {
      setLoading(false);
    }
  }, [liveState, pServeA, pServeB]);

  return {
    markets,
    loading,
    error,
    matchProgress,
    modelWeight,
    marketWeight,
    dominant,
    lastUpdate,
  };
}
