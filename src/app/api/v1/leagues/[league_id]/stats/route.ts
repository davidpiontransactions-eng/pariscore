import { NextRequest, NextResponse } from "next/server";
import type { LeagueStatsResponse, LocationFilter } from "@/lib/league-stats";
import { BSD_LEAGUE_IDS, LEAGUE_INFO } from "@/lib/league-mapping";
import { computeStandings } from "@/lib/league-stats-compute";
// fetchBSDRaw inline (bsd-football-fetcher n'exporte pas sa fonction interne)

const VALID_LOCATIONS = new Set(["all", "home", "away"]);
const CACHE_TTL = 60 * 60_000; // 1h

function cacheEntry<T>(key: string): T | null {
  const entry = (globalThis as any)[key];
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.data;
  return null;
}
function cacheSet<T>(key: string, data: T) {
  (globalThis as any)[key] = { data, at: Date.now() };
}

// Import sélectif — bsdFetchRaw n'est pas exporté, on refait le fetch direct
async function fetchBSDRaw<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");
  const res = await fetch(`https://sports.bzzoiro.com/api${endpoint}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ league_id: string }> },
) {
  const { league_id } = await params;
  const url = new URL(req.url);
  const season = url.searchParams.get("season") || "2025";
  const location = (url.searchParams.get("location") || "all") as LocationFilter;

  if (!VALID_LOCATIONS.has(location)) {
    return NextResponse.json(
      { error: "Invalid location. Use all, home, or away" },
      { status: 400 },
    );
  }

  const leagueInfo = LEAGUE_INFO[league_id];
  const bsdId = BSD_LEAGUE_IDS[league_id];
  if (!leagueInfo || !bsdId) {
    return NextResponse.json(
      { error: `League not found: '${league_id}'` },
      { status: 404 },
    );
  }

  const cacheKey = `__leagueStats_${league_id}_${season}_${location}`;
  const cached = cacheEntry<LeagueStatsResponse>(cacheKey);
  if (cached) {
    return NextResponse.json({
      ...cached,
      meta: { ...cached.meta, source: "cache" as const },
    });
  }

  try {
    // Fetch finished matches — BSD n'a pas de filtre league_id fiable côté API,
    // on fetch toutes les saisons récentes et on filtre par league.id dans la réponse.
    const raw = await fetchBSDRaw<any>(
      `/matches/?status=finished&limit=500`,
    );
    // BSD returns paginated { count, results } — extract results array
    const allMatches: any[] = Array.isArray(raw) ? raw : raw?.results ?? [];
    console.log(`[league-stats] BSD returned ${allMatches.length} finished matches`);
    if (allMatches.length > 0) {
      const leagueIds = [...new Set(allMatches.slice(0, 20).map((m: any) => m?.league?.id))];
      console.log(`[league-stats] Sample league IDs:`, leagueIds, `| looking for bsdId=${bsdId}`);
    }
    // Filter by league ID (BSD response: league.id matches bsdId)
    const matches = allMatches.filter((m: any) => m?.league?.id === bsdId);
    console.log(`[league-stats] Filtered to ${matches.length} matches for ${league_id} (bsdId=${bsdId})`);
    if (matches.length === 0) {
      return NextResponse.json(
        { error: `No finished matches found for this league (bsdId=${bsdId}, total finished=${allMatches.length})` },
        { status: 404 },
      );
    }

    const { standings, marketTops } = computeStandings(matches, location);

    const data: LeagueStatsResponse = {
      league: {
        id: league_id,
        name: leagueInfo.name,
        country: leagueInfo.country,
        sport: leagueInfo.sport,
        logo: "",
        season: String(season),
      },
      location,
      standings,
      marketTops,
      meta: {
        source: "bsd",
        computedAt: new Date().toISOString(),
        ttlSeconds: CACHE_TTL / 1000,
      },
    };

    cacheSet(cacheKey, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[league-stats] ${league_id}:`, (err as Error).message);
    return NextResponse.json(
      { error: "Stats unavailable — upstream down" },
      { status: 503 },
    );
  }
}
