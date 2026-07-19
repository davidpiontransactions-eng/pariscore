import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;
// createTtlCache already wraps in { data, at }, so we store only the payload.
const cache = createTtlCache<unknown>("__cs2Cache");

export async function GET() {
  const now = Date.now();
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    if (!key) throw new Error("BSD_API_KEY not configured");

    const matches = await cs2Service.getCs2Matches(key);

    const payload = { matches, source: "bsd", cache: cs2Service._getCacheStatus?.() ?? "unknown" };
    cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
