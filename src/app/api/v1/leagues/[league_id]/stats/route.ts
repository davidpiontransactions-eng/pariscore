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
    { id: "8", name: `${leagueName} Team H`, short: "TMH", color: "#4f46e5" },
    { id: "9", name: `${leagueName} Team I`, short: "TMI", color: "#be123c" },
    { id: "10", name: `${leagueName} Team J`, short: "TMJ", color: "#047857" },
  ];

  const standings = teams.map((t, i) => {
    const played = 19 + Math.floor(Math.random() * 15);
    const pts = Math.max(15, 60 - i * 5 + Math.floor(Math.random() * 6));
    const wins = Math.floor(pts / 3);
    const draws = pts - wins * 3;
    const losses = Math.max(0, played - wins - draws);
    const gf = 25 + Math.floor((10 - i) * 3 + Math.random() * 10);
    const ga = 10 + i * 2 + Math.floor(Math.random() * 8);
    const mod = isHome ? 1.2 : isAway ? 0.8 : 1;
    const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
    return {
      rank: i + 1,
      team: { id: t.id, name: t.name, shortName: t.short, logo: "", color: t.color },
      stats: {
        played: Math.round(played * mod),
        wins: Math.round(wins * mod),
        draws: Math.max(0, Math.round(draws * mod)),
        losses: Math.max(0, Math.round(losses * mod)),
        goalsFor: Math.round(gf * mod),
        goalsAgainst: Math.round(ga * mod),
        goalDiff: Math.round((gf - ga) * mod),
        points: Math.round(pts * mod),
        pointsPerGame: Math.round((pts / Math.max(1, played)) * mod * 100) / 100,
        xG: Math.round((1.5 - i * 0.12) * 100) / 100,
        xGA: Math.round((0.5 + i * 0.1) * 100) / 100,
        xGD: Math.round((1.0 - i * 0.22) * 100) / 100,
        over15Pct: clamp(80 - i * 4 + Math.floor(Math.random() * 10)),
        over15PctL5: clamp(80 - i * 5 + Math.floor(Math.random() * 15)),
        over15PctL10: clamp(78 - i * 4 + Math.floor(Math.random() * 10)),
        under35Pct: clamp(50 + i * 4 + Math.floor(Math.random() * 10)),
        under35PctL5: clamp(50 + i * 5 + Math.floor(Math.random() * 15)),
        under35PctL10: clamp(52 + i * 4 + Math.floor(Math.random() * 10)),
        bttsYesPct: clamp(60 - i * 3 + Math.floor(Math.random() * 15)),
        bttsYesPctL5: clamp(55 - i * 4 + Math.floor(Math.random() * 20)),
        bttsYesPctL10: clamp(58 - i * 3 + Math.floor(Math.random() * 15)),
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
    let standings: any[] = [];
    let marketTops: any = {};
    let source: "bsd" | "openligadb" | "mock" = "bsd";

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
          console.log(`[league-stats] ${league_id}: OpenLigaDB unavailable — mock (${(olbErr as Error).message})`);
        }
      }
      if (source === "bsd") {
        // Fallback mock explicite : ligue connue mais aucune source réelle branchée.
        console.log(`[league-stats] ${league_id}: no BSD source — using mock data`);
        source = "mock";
        const mock = generateMockStandings(leagueInfo.name, location);
        standings = mock.standings;
        marketTops = mock.marketTops;
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
        // Fallback mock
        console.log(`[league-stats] ${league_id}: BSD fallback — using mock data (${(bsdErr as Error).message})`);
        source = "mock";
        const mock = generateMockStandings(leagueInfo.name, location);
        standings = mock.standings;
        marketTops = mock.marketTops;
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
