import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError, NotFoundError } from "@/lib/api-error";
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
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      throw new ValidationError("Missing matchId query parameter");
    }

    const match = MATCHES.find((m) => m.id === matchId);
    if (!match) {
      throw new NotFoundError("Match not found");
    }

    return NextResponse.json({
      matchId,
      a: computeEloHistory(match.playerA),
      b: computeEloHistory(match.playerB),
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/elo-history");
  }
}
