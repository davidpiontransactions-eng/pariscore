import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;
const cache = createTtlCache<{ data: unknown; at: number }>("__cs2Cache");

export async function GET() {
  const now = Date.now();
  const cached = cache.getEntry();
  if (isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached!.data);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    if (!key) throw new Error("BSD_API_KEY not configured");

    const matches = await cs2Service.getCs2Matches(key);

    const payload = { matches, source: "bsd", cache: cs2Service._getCacheStatus?.() ?? "unknown" };
    cache.set({ data: payload, at: now });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
