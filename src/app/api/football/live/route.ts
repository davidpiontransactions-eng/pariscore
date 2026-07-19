import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 30_000;

// createTtlCache already wraps in { data, at }, so we store only the payload.
type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__footballLiveCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: "bsd",
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const matches = await fetchBSDFootballLive();
    cache.set({ matches });
    return NextResponse.json({
      matches,
      source: "bsd",
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[football-live] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football live data unavailable" },
      { status: 503 }
    );
  }
}
