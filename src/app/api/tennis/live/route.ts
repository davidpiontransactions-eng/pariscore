import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";

const CACHE_TTL_MS = 30_000;

let cache: { data: unknown[]; at: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    const bsdKey = process.env.BSD_API_KEY;
    const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";

    if (cache && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ matches: cache.data, source: "cache", updatedAt: new Date(cache.at).toISOString() });
    }

    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDLiveMatches } = await import("@/lib/bsd-fetcher");
        const matches = await fetchBSDLiveMatches();
        cache = { data: matches, at: now };
        return NextResponse.json({ matches, source: "bsd", updatedAt: new Date(now).toISOString() });
      } catch (err) {
        console.error("[tennis-live] BSD failed:", (err as Error).message);
      }
    }

    return NextResponse.json({ matches: [], source: "empty", updatedAt: new Date(now).toISOString() });
  } catch (err) {
    return apiErrorHandler(err, "tennis/live");
  }
}
