import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;

type CachedMatches = { data: unknown[]; at: number };
const cache = createTtlCache<CachedMatches>("__footballMatchesCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({ matches: cached!.data, source: "bsd", updatedAt: new Date(cached!.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const [prematch, live] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
    ]);
    const matches = [...live, ...prematch];
    cache.set({ data: matches, at: now });
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football data unavailable" },
      { status: 503 }
    );
  }
}
