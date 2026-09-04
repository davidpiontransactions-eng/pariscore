import { NextResponse, NextRequest } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  TENNIS_TOP5_METRICS,
  normPlayerName,
  surfaceToKey,
  type TennisTop5Key,
  type TennisTop5Def,
  type TennisTop5MetricRow,
  type Top5Surface,
  type Top5Period,
} from "@/lib/tennis-top5";
import { getStatsLeaderboard } from "@/lib/tennis-stats/leaderboard";
import { getOfficialLeaderboard } from "@/lib/tennis-stats/official-leaderboard";
import { getTop5PlayerStats } from "@/lib/tennis-top5-stats";
import {
  buildTennisTop10,
  type TennisTop10Payload,
} from "@/lib/tennis-top10";

/**
 * Top 10 joueurs tennis par métrique (zone centrale, refonte du top5 sidebar).
 *
 * Réutilise les mêmes sources que top5 mais retourne des JOUEURS enrichis
 * (photo, pays, classement, momentum, forme) au lieu de matchs à venir.
 */

const CACHE_TTL_MS = 60_000;
const PREMATCH_TTL_MS = 5 * 60_000;

type CachedPrematch = { matches: TennisMatch[]; source: string };
type Top10CacheEntry = { key: string; payload: TennisTop10Payload };

// Caches partagés avec top5 (même globalThis)
function getPrematchCache(): { getEntry(): { data: CachedPrematch } | null; set(data: CachedPrematch): void } {
  const g = globalThis as unknown as { __tennisPrematchCache?: { getEntry(): { data: CachedPrematch } | null; set(data: CachedPrematch): void } };
  if (!g.__tennisPrematchCache) {
    let stored: CachedPrematch | null = null;
    g.__tennisPrematchCache = {
      getEntry: () => stored ? { data: stored } : null,
      set: (data: CachedPrematch) => { stored = data; },
    };
  }
  return g.__tennisPrematchCache;
}

function getTop10Cache(): { getEntry(): Top10CacheEntry | null; set(data: Top10CacheEntry): void } {
  const g = globalThis as unknown as { __tennisTop10Cache?: { getEntry(): Top10CacheEntry | null; set(data: Top10CacheEntry): void } };
  if (!g.__tennisTop10Cache) {
    let stored: Top10CacheEntry | null = null;
    g.__tennisTop10Cache = {
      getEntry: () => stored,
      set: (data: Top10CacheEntry) => { stored = data; },
    };
  }
  return g.__tennisTop10Cache;
}

function isTop10Key(v: string | null): v is TennisTop5Key {
  return !!v && TENNIS_TOP5_METRICS.some((d: TennisTop5Def) => d.key === v);
}

async function loadPrematchMatches(): Promise<{ matches: TennisMatch[]; source: string }> {
  const cache = getPrematchCache();
  const cached = cache.getEntry();
  if (cached && Date.now() - (cached as unknown as { ts?: number }).ts < PREMATCH_TTL_MS) {
    return cached.data;
  }
  const bsdKey = process.env.BSD_API_KEY;
  const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
  if (!bsdKey || !bsdEnabled) return { matches: [], source: "empty" };
  try {
    const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
    const matches = await fetchBSDMatches();
    const data = { matches, source: "bsd" };
    cache.set(data);
    (cache as unknown as { ts?: number }).ts = Date.now();
    return data;
  } catch (err) {
    console.error("[tennis-top10] BSD failed:", (err as Error).message);
    return { matches: [], source: "empty" };
  }
}

function mergedLeaderboard(
  surface: Top5Surface,
  period: Top5Period,
): { byPlayer: Map<string, TennisTop5MetricRow>; players: number; unavailable: boolean } {
  const byPlayer = new Map<string, TennisTop5MetricRow>();
  let players = 0;
  let unavailable = true;

  const mergeRows = (rows: { player: string; [k: string]: unknown }[]) => {
    for (const row of rows) {
      const key = normPlayerName(row.player);
      if (!key) continue;
      const prev = byPlayer.get(key);
      if (!prev) {
        byPlayer.set(key, { ...row } as TennisTop5MetricRow);
        continue;
      }
      for (const k of Object.keys(row) as string[]) {
        if ((prev as Record<string, unknown>)[k] == null && row[k] != null) {
          (prev as Record<string, unknown>)[k] = row[k];
        }
      }
    }
  };

  const paramsOf = (tour: "atp" | "wta", board: "serve" | "return" | "pressure") => ({
    board,
    tour,
    surface,
    period,
    vsRank: "all" as const,
    minMatches: 5,
  });

  for (const tour of ["atp", "wta"] as const) {
    for (const board of ["serve", "return", "pressure"] as const) {
      let res = getStatsLeaderboard(paramsOf(tour, board));
      if (res.rows.length === 0) {
        const official = getOfficialLeaderboard(paramsOf(tour, board));
        if (official) {
          res = {
            rows: official.rows as typeof res.rows,
            meta: { ...paramsOf(tour, board), players: official.rows.length, generatedAt: new Date().toISOString(), dataUnavailable: false, source: official.source, coverage: official.coverage },
          };
        }
      }
      if (!res.meta.dataUnavailable && res.rows.length > 0) unavailable = false;
      if (res.rows.length > 0) players += res.meta.players;
      mergeRows(res.rows);
    }
  }
  return { byPlayer, players, unavailable };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const metricParam = sp.get("metric");
    const metric: TennisTop5Key = isTop10Key(metricParam) ? metricParam : "surfaceElo";
    const surface = (sp.get("surface") ?? "all") as Top5Surface;
    const period = (sp.get("period") ?? "52w") as Top5Period;
    const cacheKey = `${metric}:${surface}:${period}`;

    // Cache check
    const cache = getTop10Cache();
    const cached = cache.getEntry();
    if (cached && cached.key === cacheKey && Date.now() - (cached as unknown as { ts?: number }).ts < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.payload, meta: { ...cached.payload.meta, cached: true } });
    }

    const def = TENNIS_TOP5_METRICS.find((d) => d.key === metric)!;
    const needsLeaderboard = def.source === "leaderboard";

    const { matches: allMatches } = await loadPrematchMatches();

    // Leaderboard
    let lb: { byPlayer: Map<string, TennisTop5MetricRow>; players: number; unavailable: boolean } = { byPlayer: new Map(), players: 0, unavailable: false };
    if (needsLeaderboard) {
      const internal = getTop5PlayerStats(surface, period, 3);
      if (internal.byPlayer.size > 0 || !internal.unavailable) {
        lb = { byPlayer: internal.byPlayer, players: internal.players, unavailable: internal.unavailable };
      } else {
        lb = mergedLeaderboard(surface, period);
      }
    }

    // Filtre surface
    const matches = surface === "all" ? allMatches : allMatches.filter((m) => surfaceToKey(m.stats?.surface) === surface);

    // Construire le top 10
    const entries = buildTennisTop10(matches, lb.byPlayer, metric);

    const payload: TennisTop10Payload = {
      entries,
      meta: {
        metric,
        surface,
        period,
        playersConsidered: lb.players,
        computedAt: new Date().toISOString(),
      },
    };

    cache.set({ key: cacheKey, payload });
    (cache as unknown as { ts?: number }).ts = Date.now();

    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "tennis/top10");
  }
}
