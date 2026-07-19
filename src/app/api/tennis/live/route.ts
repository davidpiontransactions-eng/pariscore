import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import type { LiveMatchItem } from "@/lib/bsd-fetcher";

const CACHE_TTL_MS = 30_000;

// createTtlCache already wraps in { data, at }, so we store only the payload.
type CachedPayload = { matches: LiveMatchItem[] };
const cache = createTtlCache<CachedPayload>("__tennisLiveCache");

export async function GET() {
  try {
    const now = Date.now();
    const bsdKey = process.env.BSD_API_KEY;
    const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS)) {
      return NextResponse.json({
        matches: cached.data.matches,
        source: "cache",
        updatedAt: new Date(cached.at).toISOString(),
      });
    }

    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDLiveMatches } = await import("@/lib/bsd-fetcher");
        const matches = await fetchBSDLiveMatches();
        cache.set({ matches });
        return NextResponse.json({
          matches,
          source: "bsd",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[tennis-live] BSD failed:", (err as Error).message);
      }
    }

    return NextResponse.json({
      matches: [],
      source: "empty",
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/live");
  }
}
