import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;

// createTtlCache already wraps in { data, at }, so we store only the payload.
type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__footballMatchesCache");

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
    const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const { fetchOpenLigaDB2Bundesliga } = await import("@/lib/openligadb-fetcher");
    const [prematch, live, olb] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
      // 2. Bundesliga — ligue absente de BSD, source gratuite OpenLigaDB.
      fetchOpenLigaDB2Bundesliga().catch(() => [] as never[]),
    ]);
    const matches = [...live, ...prematch, ...olb];
    const hasOlb = olb.length > 0;
    cache.set({ matches });
    return NextResponse.json({
      matches,
      source: hasOlb ? "bsd+openligadb" : "bsd",
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[football] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football data unavailable" },
      { status: 503 }
    );
  }
}
