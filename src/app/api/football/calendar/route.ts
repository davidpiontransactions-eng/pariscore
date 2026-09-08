import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;
type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };
const cache = createTtlCache<CachedPayload>("__footballCalendarCache");

// Paris date formatter singleton
const parisDayFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric", month: "2-digit", day: "2-digit",
});

function toParisDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "";
  return parisDayFmt.format(date);
}

export async function GET(request: Request) {
  const now = Date.now();
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const liveOnly = url.searchParams.get("live") === "true";
  const statusParam = url.searchParams.get("status"); // "FT", "LIVE", "HT", "scheduled"

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    let matches = cached.data.matches as any[];
    if (dateParam) matches = matches.filter((m: any) => toParisDateKey(m.scheduledAt) === dateParam);
    if (liveOnly) matches = matches.filter((m: any) => m.live?.status === "LIVE" || m.live?.status === "HT");
    if (statusParam) matches = matches.filter((m: any) => {
      if (statusParam === "scheduled") return !m.live || m.live.status === "scheduled" || m.live.status === "notstarted";
      return m.live?.status === statusParam;
    });
    return NextResponse.json({ matches, source: cached.data.source, degraded: false, updatedAt: new Date(cached.at).toISOString() });
  }

  try {
    const { fetchBSDFootballPrematch, fetchBSDFootballLive, dedupeFootballMatches } = await import("@/lib/bsd-football-fetcher");
    const { fetchOpenLigaDB2Bundesliga } = await import("@/lib/openligadb-fetcher");
    const [prematch, live, olb] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
      fetchOpenLigaDB2Bundesliga().catch(() => [] as never[]),
    ]);
    // Déduplique live/prematch (même fixture, ids différents) — le live prime.
    let matches = dedupeFootballMatches([...live, ...prematch, ...olb]);
    const bsdOk = live.length > 0 || prematch.length > 0;
    const degraded = !bsdOk;
    const source = bsdOk ? "bsd+openligadb" : "openligadb";
    if (!degraded) cache.set({ matches, degraded, source });

    if (dateParam) matches = matches.filter((m: any) => toParisDateKey(m.scheduledAt) === dateParam);
    if (liveOnly) matches = matches.filter((m: any) => m.live?.status === "LIVE" || m.live?.status === "HT");
    if (statusParam) matches = matches.filter((m: any) => {
      if (statusParam === "scheduled") return !m.live || m.live.status === "scheduled" || m.live.status === "notstarted";
      return m.live?.status === statusParam;
    });

    return NextResponse.json({ matches, source, degraded, updatedAt: new Date(now).toISOString() });
  } catch (err) {
    return apiErrorHandler(err, "football/calendar");
  }
}