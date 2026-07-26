import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchMatches } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 30_000; // 30s — rafraîchi pendant un live
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdMatchesCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheKey = searchParams.get("status") ?? searchParams.get("date_from") ?? "__all";
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchMatches({
      date_from: searchParams.get("date_from") ?? undefined,
      date_to: searchParams.get("date_to") ?? undefined,
      tournament: searchParams.get("tournament") ?? undefined,
      player: searchParams.get("player") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/matches");
  }
}
