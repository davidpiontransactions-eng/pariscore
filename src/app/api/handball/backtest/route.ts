import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import { toHandballMatch, resolveHandballDataFile, type FlashscoreMatch } from "@/lib/handball-flashscore";
import type { HandballBacktestResult } from "@/lib/handball-backtest";
import type { HandballCLVResult } from "@/lib/handball-cmp-backtest";

// Cache par ligue × mode (le backtest dépend du filtre) — TTL 15 min (snapshot).
const CACHE_TTL_MS = 15 * 60_000;
const cache = createTtlCache<{
  league: string;
  mode: string;
  payload: HandballBacktestResult | HandballCLVResult;
}>("__handballBacktestCache");

function loadFinished() {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const raw = (data.matches || []) as FlashscoreMatch[];
    return raw
      .map((m, i) => toHandballMatch(m, i))
      .filter((m) => m.status === "finished" && m.score);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get("league") || "all";
    const mode = searchParams.get("mode") === "clv" ? "clv" : "simulated";

    const entry = cache.getEntry();
    if (
      entry &&
      isFresh(entry, CACHE_TTL_MS) &&
      entry.data.league === league &&
      entry.data.mode === mode
    ) {
      return NextResponse.json(entry.data.payload);
    }

    const finished = loadFinished();
    if (mode === "clv") {
      const { clvCoverage, runHandballCLVBacktest } = await import("@/lib/handball-cmp-backtest");
      const { coverage } = clvCoverage(finished, league);
      // Repli simulé si openingOdds < 50 % des matchs (plan §5).
      // Le widget détecte simulatedOdds=true et affiche l'avis de repli.
      const payload =
        coverage >= 0.5
          ? (runHandballCLVBacktest(finished, league) as HandballCLVResult)
          : ((await import("@/lib/handball-backtest")).runHandballBacktest(finished, league) as HandballBacktestResult);
      if (payload) {
        cache.set({ league, mode, payload });
        return NextResponse.json(payload);
      }
    }

    const { runHandballBacktest } = await import("@/lib/handball-backtest");
    const payload = runHandballBacktest(finished, league);
    cache.set({ league, mode, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/backtest");
  }
}
