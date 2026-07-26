import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchPlayers } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 5 * 60_000;
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdPlayersCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const cacheKey = search ?? "__all";
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchPlayers({
      gender: searchParams.get("gender") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      search: search ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/players");
  }
}
