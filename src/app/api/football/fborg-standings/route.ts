import { NextRequest, NextResponse } from "next/server";
import { getFbOrgStandings, LEAGUE_CODE_MAP, warmFbOrgStandingsCache } from "@/lib/football-data-org";

// GET /api/football/fborg-standings?league=netherlands&season=2025
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const league = searchParams.get("league");
  const season = searchParams.get("season") || undefined;
  const warm = searchParams.get("warm") === "true";
  const list = searchParams.get("list") === "true";

  if (list) {
    return NextResponse.json({
      leagues: Object.entries(LEAGUE_CODE_MAP).map(([slug, code]) => ({ slug, code })),
      count: Object.keys(LEAGUE_CODE_MAP).length,
    });
  }

  if (!league) {
    return NextResponse.json(
      { error: "Paramètre 'league' requis (ex: netherlands, portugal, england2)" },
      { status: 400 },
    );
  }

  if (warm) {
    const slugs = league.split(",");
    await warmFbOrgStandingsCache(slugs, season);
    return NextResponse.json({ ok: true, warmed: slugs });
  }

  const data = await getFbOrgStandings(league, season);

  if (!data) {
    return NextResponse.json(
      { error: "Données non disponibles", league, season },
      { status: 404 },
    );
  }

  return NextResponse.json({
    league,
    season: season ?? "current",
    home: data.home.slice(0, 5), // top 5 pour test
    away: data.away.slice(0, 5),
    total: data.total.slice(0, 5),
    meta: {
      homeCount: data.home.length,
      awayCount: data.away.length,
      totalCount: data.total.length,
    },
  });
}