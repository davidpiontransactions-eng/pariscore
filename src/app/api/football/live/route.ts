import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { LIVE_MATCHES } from "@/lib/football-data";

const CACHE_TTL_REAL_MS = 30_000;
const CACHE_TTL_MOCK_MS = 30_000;

type Source = "bsd" | "mock";
type CacheEntry = { data: unknown[]; source: Source; at: number };
let cache: CacheEntry | null = null;

function cacheTtl(source: Source): number {
  return source === "mock" ? CACHE_TTL_MOCK_MS : CACHE_TTL_REAL_MS;
}

export async function GET() {
  try {
    const now = Date.now();
    const bsdKey = process.env.BSD_API_KEY;

    if (cache && now - cache.at < cacheTtl(cache.source)) {
      return NextResponse.json({ matches: cache.data, source: cache.source, updatedAt: new Date(cache.at).toISOString() });
    }

    if (bsdKey) {
      try {
        const { fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
        const matches = await fetchBSDFootballLive();
        cache = { data: matches, source: "bsd", at: now };
        return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
      } catch (err) {
        console.error("[football-live] BSD failed:", (err as Error).message);
      }
    }

    cache = { data: LIVE_MATCHES, source: "mock", at: now };
    return NextResponse.json({ matches: LIVE_MATCHES, source: "mock", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    return apiErrorHandler(err, "football/live");
  }
}
