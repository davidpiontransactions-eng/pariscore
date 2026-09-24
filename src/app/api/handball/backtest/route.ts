import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import { toHandballMatch, resolveHandballDataFile, type FlashscoreMatch } from "@/lib/handball-flashscore";
import type { HandballBacktestResult } from "@/lib/handball-backtest";

// Cache par ligue (le backtest dépend du filtre) — TTL 15 min (données snapshot).
const CACHE_TTL_MS = 15 * 60_000;
const cache = createTtlCache<{ league: string; payload: HandballBacktestResult }>(
  "__handballBacktestCache",
);

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

    const entry = cache.getEntry();
    if (entry && isFresh(entry, CACHE_TTL_MS) && entry.data.league === league) {
      return NextResponse.json(entry.data.payload);
    }

    const { runHandballBacktest } = await import("@/lib/handball-backtest");
    const finished = loadFinished();
    const payload = runHandballBacktest(finished, league);
    cache.set({ league, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/backtest");
  }
}
