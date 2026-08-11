import { NextRequest, NextResponse } from "next/server";
import { getPressReview, type PressReviewResult } from "@/lib/tennis-press-review-service";

/**
 * GET /api/v1/tennis/press-review?matchId=xxx&playerA=Iga+Swiatek&playerB=Diana+Shnaider
 *
 * Revue de presse tennis — agrège 3+ prédictions issues de la presse spécialisée
 * (TennisMajors, LastWordOnSports, Eurosport, etc.) avec consensus des médias.
 *
 * Paramètres optionnels : tournament, surface (précision pour le LLM fallback).
 * Retourne `{ review: null }` si moins de 3 sources disponibles (200, pas une erreur).
 * Cache 24h (mémoire + disque), TTL côté client suggéré 10 min (SWR dedup).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const playerA = url.searchParams.get("playerA");
  const playerB = url.searchParams.get("playerB");
  const tournament = url.searchParams.get("tournament") ?? undefined;
  const surface = url.searchParams.get("surface") ?? undefined;

  if (!matchId || !playerA || !playerB) {
    return NextResponse.json(
      { error: "matchId, playerA and playerB are required" },
      { status: 400 },
    );
  }

  // Garde-fous
  if (playerA.length > 100 || playerB.length > 100 || matchId.length > 150) {
    return NextResponse.json({ error: "params too long" }, { status: 400 });
  }

  const review: PressReviewResult | null = await getPressReview({
    matchId,
    playerAName: playerA,
    playerBName: playerB,
    tournamentName: tournament,
    surface,
  });

  if (!review) {
    return NextResponse.json(
      { review: null, meta: { ttlSeconds: 24 * 60 * 60 } },
      { status: 200 },
    );
  }

  return NextResponse.json({
    review,
    meta: { ttlSeconds: 24 * 60 * 60 },
  });
}
