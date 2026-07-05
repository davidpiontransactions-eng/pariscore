import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/tennis-data";
import { computeEloHistory } from "@/lib/prediction/elo-history";

/**
 * GET /api/tennis/elo-history?matchId=m1
 *
 * Returns the Elo progression (12 months) for both players of a match.
 * In production, replace `computeEloHistory` with a real fetch from your
 * stats backend.
 *
 * Response:
 * {
 *   matchId: "m1",
 *   a: { playerId, currentElo, history: [{ date, elo }, ...] },
 *   b: { playerId, currentElo, history: [{ date, elo }, ...] }
 * }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");

  if (!matchId) {
    return NextResponse.json(
      { error: "Missing matchId query parameter" },
      { status: 400 }
    );
  }

  const match = MATCHES.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({
    matchId,
    a: computeEloHistory(match.playerA),
    b: computeEloHistory(match.playerB),
  });
}
