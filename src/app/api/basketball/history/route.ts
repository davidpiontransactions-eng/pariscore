/**
 * API route — Historique matchs basketball (table basketball_match_history).
 * GET /api/basketball/history?league=NBA&from=2025-01-01&to=2025-12-31&team=BOS&limit=500
 *
 * Peuplée par seed_historique_basketball.js (ESPN + api-live EuroLeague).
 * Cache multi-worker 5 min par clé de requête (pattern cached-route.ts).
 * Base absente → 200 avec meta: null et matches: [] (dégradation propre).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadBasketballHistory,
  basketballHistoryMeta,
  type BasketballHistoryFilter,
} from "@/lib/basketball-history-db";

type HistoryPayload = {
  meta: ReturnType<typeof basketballHistoryMeta>;
  count: number;
  matches: ReturnType<typeof loadBasketballHistory>;
};

type Entry = { data: HistoryPayload; at: number };
const g = globalThis as unknown as { __bbHistoryCache?: Map<string, Entry> };
const cacheMap = (g.__bbHistoryCache ??= new Map<string, Entry>());
const CACHE_TTL = 5 * 60_000;

const VALID_LEAGUES = new Set(["NBA", "WNBA", "EuroLeague", "EuroCup"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const team = searchParams.get("team") || undefined;
  const limit = Number(searchParams.get("limit") || 500);

  if (league && !VALID_LEAGUES.has(league)) {
    return NextResponse.json({ error: `Invalid league. Must be one of: ${[...VALID_LEAGUES].join(", ")}` }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ from, to })) {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return NextResponse.json({ error: `Invalid ${k} date (YYYY-MM-DD)` }, { status: 400 });
    }
  }

  const cacheKey = JSON.stringify([league, from, to, team, limit]);
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const filter: BasketballHistoryFilter = {
    league: league || undefined,
    from: from || undefined,
    to: to || undefined,
    team: team ? team.toUpperCase() : undefined,
    limit: Number.isFinite(limit) ? limit : 500,
  };

  const data: HistoryPayload = {
    meta: basketballHistoryMeta(),
    count: 0,
    matches: [],
  };
  data.matches = loadBasketballHistory(filter);
  data.count = data.matches.length;

  cacheMap.set(cacheKey, { data, at: Date.now() });
  return NextResponse.json(data);
}
