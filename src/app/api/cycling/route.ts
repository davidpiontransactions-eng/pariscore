import { NextResponse } from "next/server";

const CACHE_TTL = 30 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const cyclingService = require("../../../../services/cyclingService");
    const data = await cyclingService.getCyclingFull();
    const favourites = await cyclingService.getStageFavourites().catch(() => []);

    cache = { data: { ...data, favourites }, at: now };
    return NextResponse.json({ ...data, favourites, source: "plackett-luce" });
  } catch (err) {
    return NextResponse.json(
      { error: "cycling data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
