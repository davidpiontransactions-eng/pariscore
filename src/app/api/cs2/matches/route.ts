import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    if (!key) throw new Error("BSD_API_KEY not configured");

    const matches = await cs2Service.getCs2Matches(key);

    cache = { data: { matches, source: "bsd", cache: cs2Service._getCacheStatus?.() ?? "unknown" }, at: now };
    return NextResponse.json(cache.data);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
