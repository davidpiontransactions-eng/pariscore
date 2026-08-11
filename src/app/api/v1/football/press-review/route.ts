import { NextRequest, NextResponse } from "next/server";
import { getFootballPressReview } from "@/lib/football-press-review-service";
import type { FootballPressReviewResult } from "@/lib/football-press-review-service";

/**
 * GET /api/v1/football/press-review?matchId=xxx&home=PSG&away=Marseille&league=Ligue+1
 *
 * Revue de presse football — agrege 3+ predictions issues de la presse specialisee
 * (Forebet, FootyStats, SportyTrader, WhoScored, LastWordOnSports) avec consensus des medias.
 *
 * Parametre optionnel : league (precision pour le LLM fallback).
 * Retourne `{ review: null }` si moins de 3 sources disponibles (200, pas une erreur).
 * Cache 24h (memoire + disque), TTL cote client suggere 10 min (SWR dedup).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const home = url.searchParams.get("home");
  const away = url.searchParams.get("away");
  const league = url.searchParams.get("league") ?? undefined;

  if (!matchId || !home || !away) {
    return NextResponse.json(
      { error: "matchId, home and away are required" },
      { status: 400 },
    );
  }

  // Garde-fous
  if (home.length > 100 || away.length > 100 || matchId.length > 150) {
    return NextResponse.json({ error: "params too long" }, { status: 400 });
  }

  const review: FootballPressReviewResult | null = await getFootballPressReview({
    matchId,
    homeTeam: home,
    awayTeam: away,
    leagueName: league,
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
