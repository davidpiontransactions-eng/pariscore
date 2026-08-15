import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/basketball/h2h/teams?league=nba|wnba
 * Liste des équipes (id, nom, abbr, logo) pour le sélecteur de paire H2H.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = (searchParams.get("league") || "wnba").toLowerCase();

  if (league !== "nba" && league !== "wnba") {
    return NextResponse.json(
      { error: "paramètre league invalide", details: "league=nba|wnba requis" },
      { status: 400 }
    );
  }

  try {
    const svc = require("../../../../../../../services/basketballH2HService");
    const teams = await svc.getTeams(league);
    return NextResponse.json(teams, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=21600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "équipes indisponibles", details: (err as Error).message },
      { status: 503 }
    );
  }
}
