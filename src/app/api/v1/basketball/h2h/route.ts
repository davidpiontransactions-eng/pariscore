import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/basketball/h2h?league=nba|wnba&teamA={id}&teamB={id}
 * Stats H2H complètes : split, data points, stats saison par venue,
 * répartitions Over (points/quartiers/mi-temps), spread, match over, BTTS.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = (searchParams.get("league") || "wnba").toLowerCase();
  const teamA = searchParams.get("teamA") || "";
  const teamB = searchParams.get("teamB") || "";

  if (league !== "nba" && league !== "wnba") {
    return NextResponse.json(
      { error: "paramètre league invalide", details: "league=nba|wnba requis" },
      { status: 400 }
    );
  }
  if (!teamA || !teamB) {
    return NextResponse.json(
      { error: "paramètres manquants", details: "teamA et teamB (ids ESPN) requis" },
      { status: 400 }
    );
  }

  try {
    const svc = require("../../../../../../services/basketballH2HService");
    if (teamA === teamB) {
      return NextResponse.json(
        { error: "paire invalide", details: "teamA et teamB doivent être distincts" },
        { status: 400 }
      );
    }
    const data = await svc.getH2H(league, teamA, teamB, {
      before: searchParams.get("before") || undefined,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=21600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "données H2H indisponibles", details: (err as Error).message },
      { status: 503 }
    );
  }
}
