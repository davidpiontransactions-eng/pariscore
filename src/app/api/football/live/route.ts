import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 30_000;

type CachedMatches = { data: unknown[]; at: number };
const cache = createTtlCache<CachedMatches>("__footballLiveCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({ matches: cached!.data, source: "bsd", updatedAt: new Date(cached!.at).toISOString() });
  }

  try {
    const { fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const matches = await fetchBSDFootballLive();
    cache.set({ data: matches, at: now });
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football-live] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football live data unavailable" },
      { status: 503 }
    );
  }
}
