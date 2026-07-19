import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 30 * 60_000;
// createTtlCache already wraps in { data, at }, so we store only the payload.
const cache = createTtlCache<unknown>("__cyclingCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  try {
    const cyclingService = require("../../../../services/cyclingService");
    const data = await cyclingService.getCyclingFull();
    const favourites = await cyclingService.getStageFavourites().catch(() => []);

    cache.set({ ...data, favourites });
    return NextResponse.json({ ...data, favourites, source: "plackett-luce" });
  } catch (err) {
    return NextResponse.json(
      { error: "cycling data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
