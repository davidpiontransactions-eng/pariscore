import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchRankings } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 60 * 60_000; // 1h — classements mis à jour une fois par semaine
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdRankingsCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "ATP";

    const cacheKey = type;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchRankings({
      type,
      date: searchParams.get("date") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/rankings");
  }
}
