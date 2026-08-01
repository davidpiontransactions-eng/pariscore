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
// ── Mock data generator (fallback quand BSD n'a pas de matchs pour cette ligue) ──

function generateMockStandings(leagueName: string, location: string) {
  const isHome = location === "home";
  const isAway = location === "away";
  const teams = [
    { id: "1", name: `${leagueName} Team A`, short: "TMA", color: "#e11d48" },
    { id: "2", name: `${leagueName} Team B`, short: "TMB", color: "#2563eb" },
    { id: "3", name: `${leagueName} Team C`, short: "TMC", color: "#16a34a" },
    { id: "4", name: `${leagueName} Team D`, short: "TMD", color: "#ca8a04" },
    { id: "5", name: `${leagueName} Team E`, short: "TME", color: "#9333ea" },
    { id: "6", name: `${leagueName} Team F`, short: "TMF", color: "#0891b2" },
    { id: "7", name: `${leagueName} Team G`, short: "TMG", color: "#ea580c" },
    { id: "8", name: `${leagueName} Team H", short: "TMH", color: "#4f46e5" },
    { id: "9", name: `${leagueName} Team I", short: "TMI", color: "#be123c" },
    { id: "10", name: `${leagueName} Team J", short: "TMJ", color: "#047857" },
  ];

  const standings = teams.map((t, i) => {
    const basePts = 60 - i * 5 + Math.floor(Math.random() * 6);
    const played = 19 + Math.floor(Math.random() * 15);
    const wins = Math.floor(basePts / 3);
    const draws = basePts - wins * 3;
    const gf = 25 + Math.floor((10 - i) * 3 + Math.random() * 10);
    const ga = 10 + i * 2 + Math.floor(Math.random() * 8);
    const mod = isHome ? 1.2 : isAway ? 0.8 : 1;
    return {
      rank: i + 1,
      team: { id: t.id, name: t.name, shortName: t.short, logo: "", color: t.color },
      stats: {
        played: Math.round(played * mod),
        wins: Math.round(wins * mod),
        draws: Math.max(0, Math.round(draws * mod)),
        losses: Math.max(0, Math.round((played - wins - draws) * mod)),
        goalsFor: Math.round(gf * mod),
        goalsAgainst: Math.round(ga * mod),
        goalDiff: Math.round((gf - ga) * mod),
        points: Math.round(basePts * mod),
        pointsPerGame: Math.round((basePts / Math.max(1, played)) * mod * 100) / 100,
        xG: Math.round((1.5 - i * 0.12) * 100) / 100,
        xGA: Math.round((0.5 + i * 0.1) * 100) / 100,
        xGD: Math.round((1.0 - i * 0.22) * 100) / 100,
        over15Pct: 80 - i * 4 + Math.floor(Math.random() * 10),
        over15PctL5: 80 - i * 5 + Math.floor(Math.random() * 15),
        over15PctL10: 78 - i * 4 + Math.floor(Math.random() * 10),
        under35Pct: 50 + i * 4 + Math.floor(Math.random() * 10),
        under35PctL5: 50 + i * 5 + Math.floor(Math.random() * 15),
        under35PctL10: 52 + i * 4 + Math.floor(Math.random() * 10),
        bttsYesPct: 60 - i * 3 + Math.floor(Math.random() * 15),
        bttsYesPctL5: 55 - i * 4 + Math.floor(Math.random() * 20),
        bttsYesPctL10: 58 - i * 3 + Math.floor(Math.random() * 15),
      },
    };
  });

  const mkTop = (key: string, higherBetter: boolean) =>
    [...standings]
      .sort((a: any, b: any) => higherBetter ? b.stats[key] - a.stats[key] : a.stats[key] - b.stats[key])
      .slice(0, 5)
      .map((s: any) => ({
        teamId: s.team.id,
        teamName: s.team.name,
        shortName: s.team.shortName,
        logo: "",
        value: s.stats[key],
      }));

  return {
    standings,
    marketTops: {
      pointsPerGame: mkTop("pointsPerGame", true),
      over15Pct: mkTop("over15Pct", true),
      under35Pct: mkTop("under35Pct", true),
      bttsYesPct: mkTop("bttsYesPct", true),
      xG: mkTop("xG", true),
      xGA: mkTop("xGA", false),
    },
  };
}

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
    let standings: any[];
    let marketTops: any;
    let source: "bsd" | "mock" = "bsd";

    // Try BSD — fetch finished matches, filter by league
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
      // Fallback: générer des données mock pour la démo
      console.log(`[league-stats] ${league_id}: BSD fallback — using mock data (${(bsdErr as Error).message})`);
      source = "mock";
      const mock = generateMockStandings(leagueInfo.name, location);
      standings = mock.standings;
      marketTops = mock.marketTops;
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
