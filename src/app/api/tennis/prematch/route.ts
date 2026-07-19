import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL_MS = 5 * 60_000;
const PAST_GRACE_MS = 30 * 60_000;

// The cache stores the API payload shape directly. `createTtlCache` already
// wraps the value in `{ data, at }`, so we must NOT add our own `{ data, at }`
// wrapper here (that caused bug A9: `cached.data` was the inner object instead
// of the matches array, crashing client-side with "matches is not iterable").
type CachedPayload = { matches: unknown[]; source: string };
const cache = createTtlCache<CachedPayload>("__tennisPrematchCache");

function filterStale(matches: { scheduledAt: string }[]): typeof matches {
  const cutoff = Date.now() - PAST_GRACE_MS;
  return matches.filter((m) => {
    const ms = Date.parse(m.scheduledAt);
    return !Number.isFinite(ms) || ms >= cutoff;
  });
}

export async function GET() {
  try {
    const now = Date.now();

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS)) {
      return NextResponse.json({
        matches: cached.data.matches,
        source: cached.data.source,
        updatedAt: new Date(cached.at).toISOString(),
      });
    }

    const bsdKey = process.env.BSD_API_KEY;
    const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
    const oddsKey = process.env.ODDS_API_KEY;

    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
        const matches = filterStale(await fetchBSDMatches());
        cache.set({ matches, source: "bsd" });
        return NextResponse.json({
          matches,
          source: "bsd",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[prematch] BSD failed:", (err as Error).message);
      }
    }

    if (oddsKey) {
      try {
        const { fetchRealMatches } = await import("@/lib/real-matches");
        const matches = filterStale(await fetchRealMatches(oddsKey));
        cache.set({ matches, source: "odds-api" });
        return NextResponse.json({
          matches,
          source: "odds-api",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[prematch] Odds API failed:", (err as Error).message);
      }
    }

    return NextResponse.json(
      { error: "tennis prematch data unavailable" },
      { status: 503 }
    );
  } catch (err) {
    return apiErrorHandler(err, "tennis/prematch");
  }
}
