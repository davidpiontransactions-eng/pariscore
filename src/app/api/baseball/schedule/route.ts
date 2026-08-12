import { NextResponse, type NextRequest } from "next/server";
import { getSchedulePayload } from "@/lib/baseball/data/provider";
import type { LeagueFilter } from "@/lib/baseball/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_LEAGUES: readonly LeagueFilter[] = [
  "ALL",
  "MLB",
  "KBO",
  "NPB",
  "CPBL",
  "LMB",
  "LIDOM",
  "LVBP",
];

/**
 * GET /api/baseball/schedule?date=YYYY-MM-DD&league=ALL|MLB|KBO|NPB|CPBL|LMB|LIDOM|LVBP
 * Slate + prédictions rapides (2 500 itérations, cache mémoire par inputHash).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const leagueParam = (searchParams.get("league") ?? "ALL").toUpperCase();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Paramètre `date` invalide (attendu: YYYY-MM-DD)." },
      { status: 400 },
    );
  }
  const league: LeagueFilter = VALID_LEAGUES.includes(leagueParam as LeagueFilter)
    ? (leagueParam as LeagueFilter)
    : "ALL";

  try {
    const payload = await getSchedulePayload(date, league);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("[baseball/schedule]", error);
    return NextResponse.json(
      { error: "Pipeline indisponible — réessayez." },
      { status: 502 },
    );
  }
}
