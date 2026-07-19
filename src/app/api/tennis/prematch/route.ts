import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL_MS = 5 * 60_000;
const PAST_GRACE_MS = 30 * 60_000;

type CachedMatches = { data: unknown[]; source: string; at: number };
const cache = createTtlCache<CachedMatches>("__tennisPrematchCache");

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
    if (isFresh(cached, CACHE_TTL_MS)) {
      return NextResponse.json({
        matches: cached!.data,
        source: cached!.source,
        updatedAt: new Date(cached!.at).toISOString(),
      });
    }

    const bsdKey = process.env.BSD_API_KEY;
    const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
    const oddsKey = process.env.ODDS_API_KEY;

    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
        const matches = filterStale(await fetchBSDMatches());
        cache.set({ data: matches, source: "bsd", at: now });
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
        cache.set({ data: matches, source: "odds-api", at: now });
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
