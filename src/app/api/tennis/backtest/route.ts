import { NextResponse } from "next/server";
import { computeBacktestAccuracy } from "@/lib/prediction/backtest";

// Static lookup → cache responses 1h in-memory.
type CacheEntry = {
  accuracy: number | null;
  sampleSize: number;
  bucket: string | null;
  surface: string;
  eloGap: number;
  at: number;
};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map<string, CacheEntry>();

/**
 * GET /api/tennis/backtest?surface=Dur&eloGap=250
 *
 * Returns the historical accuracy of the Elo+Forme+Surface+H2H model on
 * matches similar to the inputs (same surface + same Elo-gap bucket).
 *
 * Response:
 *   {
 *     "accuracy": 82,            // 0-100, null when no data
 *     "sampleSize": 290,
 *     "bucket": "200-300",
 *     "surface": "Dur",
 *     "eloGap": 250,
 *     "cachedAt": "2026-07-05T..."
 *   }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surface = searchParams.get("surface") ?? "";
  const eloGapRaw = searchParams.get("eloGap");
  const eloGap = eloGapRaw === null ? NaN : Number(eloGapRaw);

  if (!surface) {
    return NextResponse.json(
      { error: "Missing 'surface' query param" },
      { status: 400 }
    );
  }
  if (Number.isNaN(eloGap)) {
    return NextResponse.json(
      { error: "Missing or invalid 'eloGap' query param (number expected)" },
      { status: 400 }
    );
  }

  const cacheKey = `${surface}|${eloGap}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({
      accuracy: hit.accuracy,
      sampleSize: hit.sampleSize,
      bucket: hit.bucket,
      surface: hit.surface,
      eloGap: hit.eloGap,
      cachedAt: new Date(hit.at).toISOString(),
    });
  }

  const { accuracy, sampleSize, bucket } = computeBacktestAccuracy(
    surface,
    eloGap
  );

  const entry: CacheEntry = {
    accuracy,
    sampleSize,
    bucket,
    surface,
    eloGap,
    at: now,
  };
  cache.set(cacheKey, entry);

  return NextResponse.json({
    accuracy,
    sampleSize,
    bucket,
    surface,
    eloGap,
    cachedAt: new Date(now).toISOString(),
  });
}
