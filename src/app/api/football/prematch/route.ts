import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

const CACHE_TTL = 5 * 60_000;
const PAST_GRACE_MS = 30 * 60_000;

let cache: { data: unknown[]; at: number } | null = null;

function filterStale(matches: { scheduledAt: string }[]): typeof matches {
  const cutoff = Date.now() - PAST_GRACE_MS;
  return matches.filter((m) => {
    const ms = Date.parse(m.scheduledAt);
    return !Number.isFinite(ms) || ms >= cutoff;
  });
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json({ matches: cache.data, source: "bsd", updatedAt: new Date(cache.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch } = await import("@/lib/bsd-football-fetcher");
    const matches = filterStale(await fetchBSDFootballPrematch());
    cache = { data: matches, at: now };
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football-prematch] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football prematch data unavailable" },
      { status: 503 }
    );
  }
}
