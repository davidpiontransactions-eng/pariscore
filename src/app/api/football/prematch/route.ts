import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;
const PAST_GRACE_MS = 30 * 60_000;

type CachedPayload = { matches: unknown[] };
const cache = createTtlCache<CachedPayload>("__footballPrematchCache");

function filterStale(matches: { scheduledAt: string }[]): typeof matches {
  const cutoff = Date.now() - PAST_GRACE_MS;
  return matches.filter((m) => {
    const ms = Date.parse(m.scheduledAt);
    return !Number.isFinite(ms) || ms >= cutoff;
  });
}

export async function GET() {
  const now = Date.now();
  const cached = cache.getEntry();

  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({ matches: cached.data.matches, source: "bsd", updatedAt: new Date(cached.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch } = await import("@/lib/bsd-football-fetcher");
    const matches = filterStale(await fetchBSDFootballPrematch());
    cache.set({ matches });
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football-prematch] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football prematch data unavailable" },
      { status: 503 }
    );
  }
}
