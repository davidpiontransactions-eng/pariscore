import { NextResponse } from "next/server";
import { fetchBasketballOdds, fetchOddsHistory } from "@/lib/basketball-odds";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? "nba";
  const homeTeam = searchParams.get("home") ?? "";
  const awayTeam = searchParams.get("away") ?? "";
  const history = searchParams.get("history") === "true";

  if (!homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: "home and away query params required" },
      { status: 400 },
    );
  }

  if (history) {
    const snapshots = await fetchOddsHistory(league, homeTeam, awayTeam);
    return NextResponse.json({ snapshots });
  }

  const odds = await fetchBasketballOdds(league, homeTeam, awayTeam);
  return NextResponse.json({ odds });
}
