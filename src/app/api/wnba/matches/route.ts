import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const wnbaService = require("../../../../../services/wnbaService");
    const matches = await wnbaService.getWnbaMatches();
    const topBets = wnbaService.computeNbaTopBets?.(matches, 3) ?? [];

    cache = { data: { matches, topBets, source: "espn" }, at: now };
    return NextResponse.json(cache.data);
  } catch (err) {
    return NextResponse.json(
      { error: "wnba data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
