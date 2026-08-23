import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { computeStrategyTop5Matches, type StrategyTop5 } from "@/lib/football-strategy-top5";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";

const CACHE_TTL = 30 * 60_000;

type CachePayload = StrategyTop5;

const cache = createTtlCache<CachePayload>("__footballTop5Cache");

/**
 * GET /api/football/top5
 *
 * Top 5 MATCHS à venir par stratégie de pari (Meilleure équipe, double chance,
 * Over 1.5 / Under 3.5 buts, BTTS yes, attaque, défense, Over 6.5 corners) —
 * agrégé sur toutes les ligues BSD. Un match est scoré en croisant la forme
 * récente (5 derniers matchs terminés) de l'équipe à Domicile avec celle de
 * l'équipe à Extérieur. Cotes non requises.
 * Cache serveur 30 min (les données de forme changent lentement en journée).
 */
async function fetchBSDRaw<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");
  const res = await fetch(`https://sports.bzzoiro.com/api${endpoint}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 402) throw new Error("BSD Sports Addon required (402)");
  if (res.status === 429) throw new Error("BSD rate limited (429)");
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
  return (await res.json()) as T;
}

function unpackList<T>(raw: T[] | { results?: T[] } | { count?: number; results?: T[] } | null | undefined): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { results?: T[] } | null | undefined;
  return r?.results ?? [];
}

export async function GET() {
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      ...cached.data,
      meta: { source: "cache", computedAt: new Date(cached.at).toISOString() },
    });
  }

  try {
    const [finishedRaw, fixturesRaw] = await Promise.all([
      fetchBSDRaw<{ results?: BSDFootballMatch[] } | BSDFootballMatch[]>(
        "/matches/?status=finished&limit=200&offset=0",
      ),
      fetchBSDRaw<{ results?: BSDFootballMatch[] } | BSDFootballMatch[]>(
        "/matches/?status=notstarted&limit=100",
      ),
    ]);
    const finished = unpackList<BSDFootballMatch>(finishedRaw);
    const fixtures = unpackList<BSDFootballMatch>(fixturesRaw);

    const data: StrategyTop5 = computeStrategyTop5Matches(finished, fixtures);
    cache.set(data);

    return NextResponse.json({
      ...data,
      meta: { source: "bsd", computedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[football-top5] fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "football top5 unavailable" }, { status: 503 });
  }
}
