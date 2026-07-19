import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const basketballService = require("../../../../../services/basketballService");
    const matches = await basketballService.getNbaMatches();
    const topBets = basketballService.computeNbaTopBets?.(matches, 3) ?? [];

    cache = { data: { matches, topBets, source: "espn" }, at: now };
    return NextResponse.json(cache.data);
  } catch (err) {
    return NextResponse.json(
      { error: "nba data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
