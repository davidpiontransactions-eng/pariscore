import { NextRequest, NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  TENNIS_STRATEGY_DEFS,
  buildTennisStrategyTop10,
  type TennisStrategyKey,
  type TennisStrategyTop10Result,
} from "@/lib/tennis-strategy-top10";
import { normPlayerName, type TennisTop5MetricRow } from "@/lib/tennis-top5";
import { getStatsLeaderboard, type LeaderboardRow } from "@/lib/tennis-stats/leaderboard";
import { getOfficialLeaderboard } from "@/lib/tennis-stats/official-leaderboard";
import { createTtlCache, isFresh } from "@/lib/cached-route";

/**
 * Top 10 matchs tennis par stratégie de pari — agrège les fixtures BSD
 * (cotes moneyline + stats joueurs leaderboard) via la lib pure
 * `tennis-strategy-top10.ts` (T1).
 *
 * Query params :
 *   - strat : clé stratégie (surfaceEloGap, momentum, serveHold,
 *            returnEfficacy, fatigue, underdogValue, over215,
 *            under215, favorite20). Défaut : "surfaceEloGap".
 *   - win   : fenêtre ("today" | "tomorrow" | "all"). Défaut : "all".
 *
 * Cache mémoire : 5 min (mêmes clés que les routes top5/top10).
 */

const CACHE_TTL_MS = 5 * 60_000;
const PREMATCH_TTL_MS = 5 * 60_000;

type CachedPrematch = { matches: TennisMatch[]; source: string };
type StrategyPayload = {
  strategies: Partial<Record<TennisStrategyKey, TennisStrategyTop10Result["strategies"][TennisStrategyKey]>>;
  matchesConsidered: number;
  computedAt: string;
  strategy: TennisStrategyKey;
  window: string;
  availableStrategies: TennisStrategyKey[];
};
type StrategyCacheEntry = { strat: string; win: string; payload: StrategyPayload };

const prematchCache = createTtlCache<CachedPrematch>("__tennisStrategyTop10PrematchCache");
const strategyCache = createTtlCache<StrategyCacheEntry>("__tennisStrategyTop10Cache");

function isStratKey(v: string | null): v is TennisStrategyKey {
  return !!v && TENNIS_STRATEGY_DEFS.some((d) => d.key === v);
}

async function loadPrematchMatches(): Promise<{ matches: TennisMatch[]; source: string }> {
  const cached = prematchCache.getEntry();
  if (cached && isFresh(cached, PREMATCH_TTL_MS)) return cached.data;
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
    console.error("[tennis-strategy-top10] BSD failed:", (err as Error).message);
    return { matches: [], source: "empty" };
  }
}

function mergedLeaderboard(): { byPlayer: Map<string, TennisTop5MetricRow>; players: number; unavailable: boolean } {
  const byPlayer = new Map<string, TennisTop5MetricRow>();
  let players = 0;
  let unavailable = true;

  const mergeRows = (rows: { player: string }[]) => {
    for (const row of rows) {
      const key = normPlayerName(row.player);
      if (!key) continue;
      const prev = byPlayer.get(key);
      if (!prev) {
        byPlayer.set(key, { ...(row as unknown as TennisTop5MetricRow) });
        continue;
      }
      for (const k of Object.keys(row) as string[]) {
        if ((prev as Record<string, unknown>)[k] == null && (row as Record<string, unknown>)[k] != null) {
          (prev as Record<string, unknown>)[k] = (row as Record<string, unknown>)[k];
        }
      }
    }
  };

  const paramsOf = (tour: "atp" | "wta", board: "serve" | "return" | "pressure") => ({
    board,
    tour,
    surface: "all" as const,
    period: "52w" as const,
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
            rows: official.rows as unknown as LeaderboardRow[],
            meta: {
              board,
              tour,
              surface: "all" as const,
              period: "52w" as const,
              vsRank: "all" as const,
              minMatches: 5,
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

function applyWindow(matches: TennisMatch[], win: string): TennisMatch[] {
  if (win === "all") return matches;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 3600 * 1000;
  const winStart = startOfDay + (win === "tomorrow" ? dayMs : 0);
  const winEnd = winStart + dayMs;
  return matches.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return Number.isFinite(t) && t >= winStart && t < winEnd;
  });
}


export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const stratParam = sp.get("strat");
    const strat: TennisStrategyKey = isStratKey(stratParam) ? stratParam : "surfaceEloGap";
    const win = sp.get("win") ?? "all";

    // Cache check
    const cached = strategyCache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL_MS) &&
      cached.data.strat === strat &&
      cached.data.win === win
    ) {
      return NextResponse.json({ ...cached.data.payload, cached: true });
    }

    // 1) Fixtures BSD + filtrage fenêtre
    const { matches: allMatches } = await loadPrematchMatches();
    const windowed = applyWindow(allMatches, win);

    // 2) Leaderboard fusionné (serve/return/pressure ATP+WTA)
    const { byPlayer: lbByPlayer } = mergedLeaderboard();

    // 3) Score via la lib pure (T1)
    const result = buildTennisStrategyTop10(windowed, lbByPlayer);

    // 4) Ne retourner que la stratégie demandée + méta
    const payload = {
      strategies: { [strat]: result.strategies[strat] } as Partial<
        Record<TennisStrategyKey, TennisStrategyTop10Result["strategies"][TennisStrategyKey]>
      >,
      matchesConsidered: result.matchesConsidered,
      computedAt: result.computedAt,
      strategy: strat,
      window: win,
      availableStrategies: TENNIS_STRATEGY_DEFS.map((d) => d.key),
    };

    strategyCache.set({ strat, win, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "tennis/strategy-top10");
  }
}
