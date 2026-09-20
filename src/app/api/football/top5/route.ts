import { NextRequest, NextResponse } from "next/server";
import { computeStrategyTop5Matches, type StrategyTop5 } from "@/lib/football-strategy-top5";
import { emptyStrategyTop5, readFixturesCache, writeFixturesCache } from "@/lib/football-top5-cache";
import { bsdFetch } from "@/lib/bsd-football-fetcher";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";

const CACHE_TTL = 10 * 60_000;

type CachePayload = StrategyTop5;

const cacheByKey = new Map<string, { at: number; data: CachePayload }>();

/**
 * GET /api/football/top5
 *
 * Top 5 MATCHS à venir par stratégie de pari — agrégé sur toutes les ligues BSD.
 * Cache serveur 10 min.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 5, 1), 20);
  const league = sp.get("league") ?? undefined;
  const cacheKey = `${limit}|${league ?? "all"}`;

  const cached = cacheByKey.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({
      ...cached.data,
      meta: { source: "cache", computedAt: new Date(cached.at).toISOString() },
    });
  }

  try {
    const [finished, fixtures] = await Promise.all([
      bsdFetch<BSDFootballMatch[]>(
        "/matches/?status=finished&limit=200&offset=0",
      ),
      bsdFetch<BSDFootballMatch[]>(
        "/matches/?status=notstarted&limit=100",
      ),
    ]);

    const data: StrategyTop5 = computeStrategyTop5Matches(finished, fixtures, { limit, league });
    cacheByKey.set(cacheKey, { at: Date.now(), data });
    writeFixturesCache(finished, fixtures);

    return NextResponse.json({
      ...data,
      meta: { source: "bsd", computedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[football-top5] fetch failed:", (err as Error).message);
    // Fallback 1 : re-scorer le dernier snapshot disque (TTL 6h).
    const snap = readFixturesCache();
    if (snap) {
      const replayed = computeStrategyTop5Matches(snap.finished, snap.fixtures, { limit, league });
      return NextResponse.json({
        ...replayed,
        meta: { source: "cache-fallback", computedAt: new Date(snap.at).toISOString(), error: (err as Error).message },
      });
    }
    // Fallback 2 : shape vide COMPLÈTE (toutes les stratégies à []).
    return NextResponse.json({
      ...emptyStrategyTop5(),
      matches: [],
      meta: { source: "fallback", computedAt: new Date().toISOString(), error: (err as Error).message },
    }, { status: 200 });
  }
}
