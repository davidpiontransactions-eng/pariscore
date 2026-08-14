"use client";

import { useMemo, useState } from "react";
import type { FootballMatch } from "@/lib/football-data";
import {
  runBacktest,
  computeReliability,
  countFinishedMatches,
  type StakingMethod,
  type BacktestResult,
  type ReliabilityResult,
} from "@/lib/football-backtest";

export type FootballBacktestState = {
  backtest: BacktestResult;
  reliability: ReliabilityResult;
  finishedCount: number;
  method: StakingMethod;
  windowDays: number;
  setMethod: (m: StakingMethod) => void;
  setWindowDays: (d: number) => void;
};

/**
 * Hook — backtest + fiabilité (Phase 4). Calcul synchrone sur les matchs fournis
 * (les matchs terminés « FT » servent d'historique réel). Window glissant 30/60/120j.
 */
export function useFootballBacktest(matches: FootballMatch[]): FootballBacktestState {
  const [method, setMethod] = useState<StakingMethod>("flat2");
  const [windowDays, setWindowDays] = useState<number>(120);

  const backtest = useMemo(
    () => runBacktest(matches, method, windowDays),
    [matches, method, windowDays],
  );

  const reliability = useMemo(
    () => computeReliability(backtest, matches),
    [backtest, matches],
  );

  const finishedCount = useMemo(() => countFinishedMatches(matches), [matches]);

  return { backtest, reliability, finishedCount, method, windowDays, setMethod, setWindowDays };
}
