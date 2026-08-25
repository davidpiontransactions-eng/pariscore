import { NextRequest, NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  TENNIS_TOP5_METRICS,
  buildTennisTop5,
  normPlayerName,
  surfaceToKey,
  type TennisTop5Def,
  type TennisTop5Entry,
  type TennisTop5Key,
  type TennisTop5MetricRow,
  type Top5Period,
  type Top5Surface,
} from "@/lib/tennis-top5";
import {
  getStatsLeaderboard,
  type LeaderboardRow,
} from "@/lib/tennis-stats/leaderboard";
import { getOfficialLeaderboard } from "@/lib/tennis-stats/official-leaderboard";
import { getTop5PlayerStats } from "@/lib/tennis-top5-stats";

/**
 * Top 5 matchs tennis par métrique joueur (widget sidebar « comme le foot »).
 *
 * Sources — zéro appel réseau superflu :
 *  - matchs : réutilise le cache global du route prematch (__tennisPrematchCache,
 *    même instance via globalThis) ; refetch BSD uniquement si absent ;
 *  - stats joueurs : getStatsLeaderboard en lecture seule sur pariscore.db
 *    (boards serve/return/pressure × surface × période, tours ATP+WTA fusionnés).
 */

const CACHE_TTL_MS = 60_000;
const PREMATCH_TTL_MS = 5 * 60_000;

type CachedPrematch = { matches: TennisMatch[]; source: string };
const prematchCache = createTtlCache<CachedPrematch>("__tennisPrematchCache");

type Top5Meta = {
  metric: TennisTop5Key;
  surface: Top5Surface;
  period: Top5Period;
  matchesConsidered: number;
  playersInLeaderboard: number;
  dataUnavailable: boolean;
  computedAt: string;
};
type Top5Payload = { entries: TennisTop5Entry[]; meta: Top5Meta };
type Top5CacheEntry = { key: string; payload: Top5Payload };
const top5Cache = createTtlCache<Top5CacheEntry>("__tennisTop5Cache");

function isTop5Key(v: string | null): v is TennisTop5Key {
  return !!v && TENNIS_TOP5_METRICS.some((d: TennisTop5Def) => d.key === v);
}

async function loadPrematchMatches(): Promise<{ matches: TennisMatch[]; source: string }> {
  const cached = prematchCache.getEntry();
  if (cached && isFresh(cached, PREMATCH_TTL_MS)) {
    return cached.data;
  }
  const bsdKey = process.env.BSD_API_KEY;
  const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
  if (!bsdKey || !bsdEnabled) return { matches: [], source: "empty" };
  try {
    const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
    const matches = await fetchBSDMatches();
    const data = { matches, source: "bsd" };
    prematchCache.set(data);
    return data;
  } catch (err) {
    console.error("[tennis-top5] BSD failed:", (err as Error).message);
    return { matches: [], source: "empty" };
  }
}

/** Fusionne les lignes ATP + WTA en une Map par nom normalisé.
 *  Les caches officiels ne remplissent que les champs du board demandé
 *  (serve → serviceGamesWonPct uniquement, etc.) : on agrège donc les 3
 *  boards et on coalesce les champs par joueur. */
function mergedLeaderboard(
  surface: Top5Surface,
  period: Top5Period,
): { byPlayer: Map<string, TennisTop5MetricRow>; players: number; unavailable: boolean } {
  const byPlayer = new Map<string, TennisTop5MetricRow>();
  let players = 0;
  let unavailable = true;

  const mergeRows = (rows: LeaderboardRow[]) => {
    for (const row of rows) {
      const key = normPlayerName(row.player);
      if (!key) continue;
      const prev = byPlayer.get(key);
      if (!prev) {
        byPlayer.set(key, { ...row });
        continue;
      }
      // Coalesce : complète les champs encore nuls du joueur existant.
      for (const k of Object.keys(row) as (keyof LeaderboardRow)[]) {
        if (prev[k] == null && row[k] != null) {
          (prev as unknown as Record<string, unknown>)[k] = row[k];
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
      // Repli officiel ATP/WTA (caches scrapés) quand l'agrégation interne est
      // vide — même stratégie que /api/tennis/stats-leaderboard (ETL non lancé
      // en dev : tennis_matches_internal à 0 rows ici ; 23k rows en prod).
      if (res.rows.length === 0) {
        const official = getOfficialLeaderboard(paramsOf(tour, board));
        if (official) {
          res = {
            rows: official.rows,
            meta: {
              ...paramsOf(tour, board),
              players: official.rows.length,
              generatedAt: new Date().toISOString(),
              dataUnavailable: false,
              source: official.source,
              coverage: official.coverage,
            },
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
    const metric: TennisTop5Key = isTop5Key(metricParam) ? metricParam : "surfaceElo";
    const surface = (sp.get("surface") ?? "all") as Top5Surface;
    const period = (sp.get("period") ?? "52w") as Top5Period;
    const cacheKey = `${metric}:${surface}:${period}`;

    const cached = top5Cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data.key === cacheKey) {
      return NextResponse.json({
        entries: cached.data.payload.entries,
        meta: { ...cached.data.payload.meta, cached: true },
      });
    }

    const def = TENNIS_TOP5_METRICS.find((d) => d.key === metric)!;
    const needsLeaderboard = def.source === "leaderboard";

    const { matches: allMatches } = await loadPrematchMatches();

    // 1) agrégation interne (table tennis_matches_internal, backfill BSD) ;
    // 2) repli caches officiels ATP/WTA si la table est vide/injoignable.
    let lb: {
      byPlayer: Map<string, TennisTop5MetricRow>;
      players: number;
      unavailable: boolean;
    } = { byPlayer: new Map(), players: 0, unavailable: false };
    if (needsLeaderboard) {
      // Seuil 3 matchs (vs 5 par défaut) : la fenêtre locale couvre ~30 jours ;
      // en prod 52w la profondeur rendra ce seuil peu contraignant.
      const internal = getTop5PlayerStats(surface, period, 3);
      if (internal.byPlayer.size > 0 || !internal.unavailable) {
        lb = { byPlayer: internal.byPlayer, players: internal.players, unavailable: internal.unavailable };
      } else {
        const fallback = mergedLeaderboard(surface, period);
        lb = fallback;
      }
    }

    // Filtre surface appliqué AUX MATCHS pour toutes les métriques.
    const matches =
      surface === "all"
        ? allMatches
        : allMatches.filter((m) => surfaceToKey(m.stats?.surface) === surface);

    const entries =
      needsLeaderboard && lb.byPlayer.size === 0
        ? []
        : buildTennisTop5(matches, lb.byPlayer, metric);

    const payload: Top5Payload = {
      entries,
      meta: {
        metric,
        surface,
        period,
        matchesConsidered: matches.length,
        playersInLeaderboard: lb.players,
        dataUnavailable: needsLeaderboard && lb.byPlayer.size === 0,
        computedAt: new Date().toISOString(),
      },
    };
    top5Cache.set({ key: cacheKey, payload });

    return NextResponse.json({
      entries: payload.entries,
      meta: { ...payload.meta },
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/top5");
  }
}
