import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 30_000;

type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__handballLiveCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      matches: cached.data.matches,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { fetchHandballLive } = await import("@/lib/handball-api");
    const matches = await fetchHandballLive();
    cache.set({ matches });
    return NextResponse.json({
      matches,
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[handball-live] fetch failed:", (err as Error).message);
    return NextResponse.json(
      { error: "handball live data unavailable" },
      { status: 503 },
    );
  }
}
