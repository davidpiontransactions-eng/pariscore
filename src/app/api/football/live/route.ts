import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

const CACHE_TTL = 30_000;

let cache: { data: unknown[]; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json({ matches: cache.data, source: "bsd", updatedAt: new Date(cache.at).toISOString() });
  }

  try {
    const { fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const matches = await fetchBSDFootballLive();
    cache = { data: matches, at: now };
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football-live] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football live data unavailable" },
      { status: 503 }
    );
  }
}
