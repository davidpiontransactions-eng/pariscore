"use client";

// useTennisMarkets — hook live pour marchés tennis.
//
// Combine les modèles Markov/Poisson avec les probabilités implicites marché
// via le blend bayésien. Poll toutes les8 secondes.

import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { gameWinProb, setWinProb, setScoreExact, setHandicap, doubleResult, firstSetWinner, clearAllMemos } from "@/lib/prediction/live-markov";
import { probOver } from "@/lib/prediction/total-games";
import { totalAcesO_U } from "@/lib/prediction/most-aces";
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

  // --- Match Winner (blendé) ---
  addMarket("match-winner", "Vainqueur du match", "match-winner", blend.prob, 1 - blend.prob);

  // --- Set Score ---
  clearAllMemos();
  addMarket("correct-score-2-0", "Score exact 2-0", "set-score", setScoreExact(holdA, holdB, 2, 0, true), 0);
  clearAllMemos();
  addMarket("correct-score-2-1", "Score exact 2-1", "set-score", setScoreExact(holdA, holdB, 2, 1, true), 0);

  // --- Set Handicap ---
  clearAllMemos();
  addMarket("set-handicap-1.5", "Handicap sets -1.5", "set-handicap", setHandicap(holdA, holdB, -1.5, true), 0);

  // --- Total Games ---
  const lambda = 9.5 * 2.1;
  const over18 = probOver(18.5, lambda);
  addMarket("total-over-18.5", "Total Over 18.5", "total-games", over18, 1 - over18);
  const over21 = probOver(21.5, lambda);
  addMarket("total-over-21.5", "Total Over 21.5", "total-games", over21, 1 - over21);

  // --- Aces ---
  const overAces = totalAcesO_U(9.5, 4, 4);
  addMarket("aces-over-9.5", "Total aces Over 9.5", "aces", overAces, 1 - overAces);

  // --- Tiebreak ---
  clearAllMemos();
  const pTB = tiebreakSet(holdA, holdB);
  addMarket("tiebreak-yes", "Tiebreak dans le match", "tiebreak", pTB, 1 - pTB);

  // --- First Set ---
  clearAllMemos();
  const pFirst = firstSetWinner(holdA, holdB);
  addMarket("first-set-winner-a", "1er set : A", "first-set", pFirst, 1 - pFirst);

  // --- Double Result ---
  clearAllMemos();
  const dr = doubleResult(holdA, holdB, true);
  addMarket("double-a-a", "A gagne 1er set + match", "double-result", dr.aWins1stAndMatch, dr.bWins1stAndMatch);

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
