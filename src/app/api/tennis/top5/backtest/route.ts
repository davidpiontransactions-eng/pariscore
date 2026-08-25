import { NextResponse } from "next/server";
import { loadTop5Entries } from "@/lib/top5-backtest/store";
import {
  aggregateStrategyStats,
  type SportBacktestSummary,
  type Top5BacktestEntry,
} from "@/lib/top5-backtest/types";
import { TENNIS_TOP5_METRICS } from "@/lib/tennis-top5";

export const dynamic = "force-dynamic";

/**
 * GET /api/tennis/top5/backtest
 *
 * Agrégats du backtest « Top 5 par métrique » tennis (même contrat que le
 * football) : lecture directe du store data/top5-backtest/tennis.json.
 */
export async function GET() {
  const entries = loadTop5Entries("tennis");
  const strategies = aggregateStrategyStats(
    entries,
    TENNIS_TOP5_METRICS.map((d) => d.key),
  );
  const recent: Top5BacktestEntry[] = [...entries]
    .filter((e) => e.status !== "pending")
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 30);

  const payload: SportBacktestSummary = {
    sport: "tennis",
    strategies,
    recent,
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
