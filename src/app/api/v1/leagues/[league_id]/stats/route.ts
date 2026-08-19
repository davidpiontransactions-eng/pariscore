import { NextRequest, NextResponse } from "next/server";
import type { LeagueStatsResponse, LocationFilter } from "@/lib/league-stats";
import { BSD_LEAGUE_IDS, BSD_UNCOVERED_LEAGUES, LEAGUE_INFO } from "@/lib/league-mapping";
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
  if (!leagueInfo || (!bsdId && !BSD_UNCOVERED_LEAGUES.has(league_id))) {
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
    let standings: any[] = [];
    let marketTops: any = {};
    let source: "bsd" | "openligadb" = "bsd";

    // Ligues non couvertes BSD (ex. 2. Bundesliga) → source alternative / mock explicite.
    if (!bsdId || BSD_UNCOVERED_LEAGUES.has(league_id)) {
      if (league_id === "bundesliga2") {
        try {
          const { fetchOpenLigaDBStandings } = await import("@/lib/openligadb-fetcher");
          const table = await fetchOpenLigaDBStandings();
          standings = table.map((r) => ({
            rank: r.rank,
            team: { id: r.teamId, name: r.name, shortName: r.shortName, logo: r.logo, color: r.color },
            stats: {
              played: r.stats.played,
              wins: r.stats.wins,
              draws: r.stats.draws,
              losses: r.stats.losses,
              goalsFor: r.stats.goalsFor,
              goalsAgainst: r.stats.goalsAgainst,
              goalDiff: r.stats.goalDiff,
              points: r.stats.points,
              pointsPerGame: r.stats.pointsPerGame,
              xG: 0,
              xGA: 0,
              xGD: 0,
              over15Pct: 0,
              over15PctL5: 0,
              over15PctL10: 0,
              under35Pct: 0,
              under35PctL5: 0,
              under35PctL10: 0,
              bttsYesPct: 0,
              bttsYesPctL5: 0,
              bttsYesPctL10: 0,
            },
          }));
          marketTops = {
            pointsPerGame: table.map((r) => ({ teamId: r.teamId, teamName: r.name, shortName: r.shortName, logo: r.logo, value: r.stats.pointsPerGame })),
            over15Pct: [],
            under35Pct: [],
            bttsYesPct: [],
            xG: [],
            xGA: [],
          };
          source = "openligadb";
          console.log(`[league-stats] ${league_id}: OpenLigaDB standings → ${standings.length} teams`);
        } catch (olbErr) {
          console.log(`[league-stats] ${league_id}: OpenLigaDB unavailable (${(olbErr as Error).message})`);
          return NextResponse.json(
            { error: "Classement indisponible : source OpenLigaDB inaccessible." },
            { status: 503 },
          );
        }
      } else {
        // Ligue connue mais aucune source réelle branchée — jamais de mock.
        console.log(`[league-stats] ${league_id}: no real source for this league`);
        return NextResponse.json(
          { error: "Classement indisponible pour cette ligue." },
          { status: 503 },
        );
      }
    } else {
      // BSD — fetch finished matches, filter by real BSD league id
      try {
        const raw = await fetchBSDRaw<any>(`/matches/?status=finished&limit=200`);
        const allMatches: any[] = Array.isArray(raw) ? raw : raw?.results ?? [];
        const leagueMatches = allMatches.filter((m: any) => m?.league?.id === bsdId);

        if (leagueMatches.length >= 5) {
          const result = computeStandings(leagueMatches, location);
          standings = result.standings;
          marketTops = result.marketTops;
          console.log(`[league-stats] ${league_id}: ${leagueMatches.length} BSD matches → ${standings.length} teams`);
        } else {
          throw new Error(`Only ${leagueMatches.length} matches found`);
        }
      } catch (bsdErr) {
        console.log(`[league-stats] ${league_id}: BSD unavailable (${(bsdErr as Error).message})`);
        return NextResponse.json(
          { error: "Classement indisponible : source BSD inaccessible." },
          { status: 503 },
        );
      }
    }

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
        source,
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
