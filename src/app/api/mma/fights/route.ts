import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const mmaService = require("../../../../../services/mmaService");
    const fights = await mmaService.getMMAFights(process.env.ODDS_API_KEY);
    cache = { data: fights, at: now };
    return NextResponse.json({ fights, source: "odds-api+ml" });
  } catch (err) {
    return NextResponse.json(
      { error: "mma data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
