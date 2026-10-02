/**
 * Moteur de backtest des marchés football (walk-forward) — vague 3, phase 1.
 *
 * Principe : les picks du journal `data/top5-backtest/football.json` sont
 * **prospectifs** (snapshot du top 5 avant le coup d'envoi, cron 05:15 UTC ;
 * rejeu historique en forme strictement antérieure pour le backfill) → le
 * backtest est walk-forward **sans lookahead**. Chaque pick est mappé sur son
 * marché via le registre (`markets.ts`), réglé par `settleFootballPick` (moteur
 * unique, via `settleEntry`), puis valorisé en **mise fixe 1u**.
 *
 * Cotes : réelles BSD uniquement, ou dérivées du dé-vig 1X2 pour la Double
 * Chance (marquées « Dérivé »). Jamais de cote synthétique : un pick sans cote
 * réelle est compté mais exclu du ROI.
 */

import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { pnlUnit, settleEntry, strategyLabel } from "@/lib/football-results";
import type { Top5BacktestEntry, Top5BacktestStatus } from "@/lib/top5-backtest/types";
import {
  AVAILABLE_MARKETS,
  BLOCKED_MARKETS,
  STRATEGY_TO_MARKET,
  type MarketDef,
  type MarketKey,
  type MarketOddsSource,
} from "./markets";

/** Échantillon minimum de paris réglés pour juger un marché (cf. handball). */
export const MIN_SAMPLE_BETS = 10;

export type MarketCardInfo = {
  key: MarketKey;
  label: string;
  availability: "available" | "blocked";
  blockedReason: string | null;
  oddsSource: MarketOddsSource;
  oddsSourceLabel: string;
};

export type MarketBet = {
  entryId: string;
  matchId: string;
  league: string;
  kickoff: string;
  strategyKey: string;
  strategyLabel: string;
  pickDesc: string;
  pick: string | null;
  odds: number | null;
  /** Origine de la cote utilisée (null si le pari n'en a pas). */
  oddsSource: MarketOddsSource | null;
  status: Top5BacktestStatus;
  /** Mise fixe 1u — 0 si non réglé ou sans cote. */
  pnl: number;
  score: string | null;
};

export type MarketBacktest = MarketCardInfo & {
  bets: MarketBet[];
  n: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  /** Paris avec cote réelle (seuls ceux-ci entrent au ROI). */
  nWithOdds: number;
  winRatePct: number | null;
  pnl: number;
  roiPct: number | null;
  /** Drawdown max (unités) sur la courbe des paris avec cote, chronologique. */
  maxDrawdown: number;
  /** Courbe de P&L cumulé (un point par pari avec cote). */
  curve: number[];
  sampleOk: boolean;
};

export type MarketBacktestResult = {
  from: string;
  to: string;
  markets: MarketBacktest[];
  blocked: MarketCardInfo[];
  totals: {
    nBets: number;
    nWithOdds: number;
    wins: number;
    losses: number;
    pnl: number;
    roiPct: number | null;
  };
  generatedAt: string;
};

export function toCardInfo(m: MarketDef): MarketCardInfo {
  return {
    key: m.key,
    label: m.label,
    availability: m.availability,
    blockedReason: m.blockedReason ?? null,
    oddsSource: m.oddsSource,
    oddsSourceLabel: m.oddsSourceLabel,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveOdds(
  market: MarketDef,
  settledOdds: number | null,
  match: BSDFootballMatch | undefined,
  pick: "home" | "away" | null,
): { odds: number | null; source: MarketOddsSource | null } {
  if (settledOdds != null && settledOdds > 1) {
    return {
      odds: settledOdds,
      source: market.oddsSource === "derived-devig" ? "derived-devig" : "bsd",
    };
  }
  if (match && market.oddsFor) {
    const o = market.oddsFor(match, pick);
    if (o != null) return { odds: o, source: market.oddsSource };
  }
  return { odds: null, source: null };
}

/**
 * Rejeu walk-forward des picks du journal sur les marchés disponibles.
 * Les marchés bloqués sont renvoyés tels quels (cartes grises côté UI).
 */
export function runMarketBacktest(input: {
  entries: Top5BacktestEntry[];
  matchesById: Map<string, BSDFootballMatch>;
  from: string;
  to: string;
}): MarketBacktestResult {
  const { entries, matchesById, from, to } = input;

  const byMarket = new Map<MarketKey, MarketBet[]>();
  for (const e of entries) {
    const market = STRATEGY_TO_MARKET.get(e.strategyKey);
    if (!market) continue; // stratégies orphelines ou marché bloqué → hors backtest
    const match = matchesById.get(e.matchId);
    const settled = settleEntry(e, match);
    const pick = (e.pick as "home" | "away" | null) ?? null;
    const { odds, source } = resolveOdds(market, settled.odds, match, pick);
    const bet: MarketBet = {
      entryId: e.id,
      matchId: e.matchId,
      league: e.league || (match?.league.name ?? "—"),
      kickoff: e.kickoff,
      strategyKey: e.strategyKey,
      strategyLabel: strategyLabel(e.strategyKey),
      pickDesc: e.pickDesc,
      pick,
      odds,
      oddsSource: source,
      status: settled.status,
      pnl: pnlUnit(settled.status, odds),
      score: settled.score ?? null,
    };
    const list = byMarket.get(market.key) ?? [];
    list.push(bet);
    byMarket.set(market.key, list);
  }

  const markets: MarketBacktest[] = AVAILABLE_MARKETS.map((def) => {
    const bets = (byMarket.get(def.key) ?? []).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    const wins = bets.filter((b) => b.status === "won").length;
    const losses = bets.filter((b) => b.status === "lost").length;
    const staked = bets.filter((b) => b.odds != null && b.odds > 1);
    const pnl = round2(bets.reduce((a, b) => a + b.pnl, 0));

    // Courbe + drawdown sur les paris avec cote (seuls misés), ordre chronologique.
    const curve: number[] = [];
    let cum = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const b of staked) {
      cum = round2(cum + b.pnl);
      curve.push(cum);
      peak = Math.max(peak, cum);
      maxDrawdown = Math.max(maxDrawdown, round2(peak - cum));
    }

    const decided = wins + losses;
    return {
      ...toCardInfo(def),
      bets,
      n: bets.length,
      wins,
      losses,
      voids: bets.filter((b) => b.status === "void").length,
      pending: bets.filter((b) => b.status === "pending").length,
      nWithOdds: staked.length,
      winRatePct: decided > 0 ? round2((wins / decided) * 100) : null,
      pnl,
      roiPct: staked.length > 0 ? round2((pnl / staked.length) * 100) : null,
      maxDrawdown,
      curve,
      sampleOk: decided >= MIN_SAMPLE_BETS,
    };
  });

  const totalStaked = markets.reduce((a, m) => a + m.nWithOdds, 0);
  const totalPnl = round2(markets.reduce((a, m) => a + m.pnl, 0));

  return {
    from,
    to,
    markets,
    blocked: BLOCKED_MARKETS.map(toCardInfo),
    totals: {
      nBets: markets.reduce((a, m) => a + m.n, 0),
      nWithOdds: totalStaked,
      wins: markets.reduce((a, m) => a + m.wins, 0),
      losses: markets.reduce((a, m) => a + m.losses, 0),
      pnl: totalPnl,
      roiPct: totalStaked > 0 ? round2((totalPnl / totalStaked) * 100) : null,
    },
    generatedAt: new Date().toISOString(),
  };
}
