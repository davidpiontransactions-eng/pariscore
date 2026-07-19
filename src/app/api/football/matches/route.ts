import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

const CACHE_TTL = 5 * 60_000;

let cache: { data: unknown[]; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json({ matches: cache.data, source: "bsd", updatedAt: new Date(cache.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const [prematch, live] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
    ]);
    const matches = [...live, ...prematch];
    cache = { data: matches, at: now };
    return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("[football] BSD failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football data unavailable" },
      { status: 503 }
    );
  }
}
