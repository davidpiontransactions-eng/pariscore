import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";

type CacheEntry = { data: unknown; at: number };
const cacheKey = "__handballStandingsCache";
const g = globalThis as unknown as Record<string, CacheEntry | undefined>;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("league");

    if (!leagueId) {
      return NextResponse.json(
        { error: "league param required" },
        { status: 400 },
      );
    }

    const key = `${cacheKey}_${leagueId}`;
    const entry = g[key] ?? null;

    if (isFresh(entry, 30 * 60_000)) {
      return NextResponse.json(entry!.data);
    }

    const { fetchHandballStandings } = await import("@/lib/handball-api");
    const standings = await fetchHandballStandings(Number(leagueId)).catch(
      () => [],
    );

    const result = { standings, updatedAt: new Date().toISOString() };
    g[key] = { data: result, at: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    return apiErrorHandler(err, "handball/standings");
  }
}
