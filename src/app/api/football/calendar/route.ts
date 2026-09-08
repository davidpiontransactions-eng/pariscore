import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;
type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };
const cache = createTtlCache<CachedPayload>("__footballCalendarCache");

export async function GET(request: Request) {
  const now = Date.now();
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date"); // YYYY-MM-DD Paris
  const liveOnly = url.searchParams.get("live") === "true";

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    let matches = cached.data.matches as any[];
    if (dateParam) matches = matches.filter((m) => {
      try { return new Date(m.scheduledAt).toISOString().slice(0, 10) === dateParam; } catch { return false; }
    });
    if (liveOnly) matches = matches.filter((m) => m.live?.status === "LIVE" || m.live?.status === "HT");
    return NextResponse.json({ matches, source: cached.data.source, degraded: false, updatedAt: new Date(cached.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const { fetchOpenLigaDB2Bundesliga } = await import("@/lib/openligadb-fetcher");
    const [prematch, live, olb] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
      fetchOpenLigaDB2Bundesliga().catch(() => [] as never[]),
    ]);
    let matches = [...live, ...prematch, ...olb];
    const bsdOk = live.length > 0 || prematch.length > 0;
    const degraded = !bsdOk;
    const source = bsdOk ? "bsd+openligadb" : "openligadb";
    if (!degraded) cache.set({ matches, degraded, source });

    // Filter by date (client param)
    if (dateParam) {
      matches = matches.filter((m: any) => {
        try { return new Date(m.scheduledAt).toISOString().slice(0, 10) === dateParam; } catch { return false; }
      });
    }
    if (liveOnly) {
      matches = matches.filter((m: any) => m.live?.status === "LIVE" || m.live?.status === "HT");
    }

    return NextResponse.json({ matches, source, degraded, updatedAt: new Date(now).toISOString() });
  } catch (err) {
    return apiErrorHandler(err, "football/calendar");
  }
}