import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchPredictions } from "@/lib/bsd-tennis-service";

const CACHE_TTL_MS = 10 * 60_000; // 10min — prédictions stables entre raffraîchissements
type CachedPayload = { data: unknown };
const cache = createTtlCache<CachedPayload>("__bsdPredictionsCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheKey = searchParams.get("match") ?? searchParams.get("date_from") ?? searchParams.get("date_to") ?? "__upcoming";
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && (cached.data as any)?._ck === cacheKey) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchPredictions({
      upcoming: searchParams.get("upcoming") !== "false",
      match: searchParams.get("match") ? Number(searchParams.get("match")) : undefined,
      date_from: searchParams.get("date_from") ?? undefined,
      date_to: searchParams.get("date_to") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    cache.set({ data: { ...data, _ck: cacheKey } });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorHandler(err, "bsd/predictions");
  }
}
