import { NextResponse } from "next/server";
import { loadTop5Entries } from "@/lib/top5-backtest/store";
import {
  aggregateStrategyStats,
  type SportBacktestSummary,
  type Top5BacktestEntry,
} from "@/lib/top5-backtest/types";
import { STRATEGY_TOP5_KEYS } from "@/lib/football-strategy-top5";

export const dynamic = "force-dynamic";

/**
 * GET /api/football/top5/backtest
 *
 * Agrégats du backtest « Top 5 par stratégie » : n, winRate, série en cours,
 * forme L10 et ROI (flat 1u, picks avec cote uniquement) par stratégie,
 * plus les 30 derniers picks réglés pour le drawer UI.
 * Lecture directe du store data/top5-backtest/football.json (aucun appel BSD).
 */
export async function GET() {
  const entries = loadTop5Entries("football");
  const strategies = aggregateStrategyStats(entries, STRATEGY_TOP5_KEYS);
  const recent: Top5BacktestEntry[] = [...entries]
    .filter((e) => e.status !== "pending")
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 30);

  const payload: SportBacktestSummary = {
    sport: "football",
    strategies,
    recent,
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
