import { NextResponse } from "next/server";
import { getCompetitiveness } from "@/lib/leagues-stats/db";

const CACHE_TTL = 30 * 60_000;

let _cache: { at: number; data: ReturnType<typeof getCompetitiveness> } | null = null;

export async function GET() {
  if (!_cache || Date.now() - _cache.at > CACHE_TTL) {
    _cache = { at: Date.now(), data: getCompetitiveness() };
  }

  return NextResponse.json(
    { stats: _cache.data, total: _cache.data.length },
    { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } },
  );
}
