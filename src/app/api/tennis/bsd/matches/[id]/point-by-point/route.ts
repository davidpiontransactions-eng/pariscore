import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchMatchPointByPoint } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 15_000; // 15s — rafraîchi pendant un live
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdMatchPBPCache");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    const cacheKey = `pbp${numId}`;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchMatchPointByPoint(numId);
    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/matches/[id]/point-by-point");
  }
}
