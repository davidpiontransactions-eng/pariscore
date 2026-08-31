import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/basketball/h2h/players?league=nba|wnba&team={id}
 * Stats joueurs de la saison (gamelogs ESPN) + classement de la ligue.
 * Les stats manquantes se complètent progressivement (enrichissement en fond).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = (searchParams.get("league") || "wnba").toLowerCase();
  const team = searchParams.get("team") || "";

  if (league !== "nba" && league !== "wnba") {
    return NextResponse.json(
      { error: "paramètre league invalide", details: "league=nba|wnba requis" },
      { status: 400 }
    );
  }
  if (!team) {
    return NextResponse.json(
      { error: "paramètre manquant", details: "team (id ESPN) requis" },
      { status: 400 }
    );
  }

  try {
    const svc = await import("../../../../../../../services/basketballH2HService");
    const [players, standings, teams] = await Promise.all([
      svc.getPlayerSeasonStats(league, team),
      svc.getStandings(league).catch(() => []),
      svc.getTeams(league).catch(() => []),
    ]);
    const info = teams.find((t: { id: string }) => t.id === team) || { id: team, name: team, abbr: "", logo: null };
    return NextResponse.json(
      { team: info, players, standings },
      { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=10800" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "stats joueurs indisponibles", details: (err as Error).message },
      { status: 503 }
    );
  }
}
