import { NextResponse } from "next/server";
import type { FootballMatchStats } from "@/lib/bsd-football-fetcher";

/**
 * GET /api/football/matches/[id]/stats
 * Momentum + xG/minute + buts d'un match live, depuis BSD /v2/events/{id}/stats/.
 *
 * Cache par-match TTL 30s (Map sur globalThis — multi-worker safe, cf. cached-route.ts).
 * 1 requête BSD par ouverture de détail (lazy) — pas de surcharge sur le list live.
 */
const CACHE_TTL = 30_000;

type CachedStats = { data: FootballMatchStats; at: number };
const g = globalThis as unknown as { __footballStatsCache?: Map<string, CachedStats> };
const cache: Map<string, CachedStats> = g.__footballStatsCache ?? new Map();
if (!g.__footballStatsCache) g.__footballStatsCache = cache;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  // L'id BSD est numérique ; on strip le préfixe "bsd-" éventuel (id du match PariScore).
  const matchId = rawId.replace(/^bsd-/, "");

  // Cache par-match
  const hit = cache.get(matchId);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json({ ...hit.data, source: "bsd-cached" });
  }

  try {
    const { fetchBSDMatchStats } = await import("@/lib/bsd-football-fetcher");
    const data = await fetchBSDMatchStats(matchId);

    cache.set(matchId, { data, at: Date.now() });
    return NextResponse.json({ ...data, source: "bsd", updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[football-stats] BSD failed for ${matchId}:`, (err as Error).message);
    return NextResponse.json(
      { error: "football match stats unavailable" },
      { status: 503 },
    );
  }
}
