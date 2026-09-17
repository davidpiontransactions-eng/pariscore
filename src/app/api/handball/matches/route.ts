import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;

type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };
const cache = createTtlCache<CachedPayload>("__handballMatchesCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { fetchHandballFixtures, fetchHandballLive } = await import("@/lib/handball-api");
    const [fixtures, live] = await Promise.all([
      fetchHandballFixtures().catch(() => [] as never[]),
      fetchHandballLive().catch(() => [] as never[]),
    ]);

    const liveIds = new Set(live.map((m) => m.id));
    const merged = [...live, ...fixtures.filter((m) => !liveIds.has(m.id))];
    const degraded = fixtures.length === 0 && live.length === 0;
    const source = live.length > 0 ? "api-sports+live" : "api-sports";
    if (!degraded) cache.set({ matches: merged, degraded, source });
    return NextResponse.json({
      matches: merged,
      source,
      degraded,
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[handball] fetch failed:", (err as Error).message);
    return NextResponse.json(
      { error: "handball data unavailable" },
      { status: 503 },
    );
  }
}
