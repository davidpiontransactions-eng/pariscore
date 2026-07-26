import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchTournaments } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 5 * 60_000;
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdTournamentsCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheKey = searchParams.get("circuit") ?? searchParams.get("surface") ?? "__all";
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchTournaments({
      circuit: searchParams.get("circuit") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      surface: searchParams.get("surface") ?? undefined,
      include_inactive: searchParams.get("include_inactive") === "true",
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/tournaments");
  }
}
