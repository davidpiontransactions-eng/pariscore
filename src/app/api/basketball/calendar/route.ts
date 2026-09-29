/**
 * API route — Calendrier Basket unifié (style FotMob).
 * GET /api/basketball/calendar?date=YYYY-MM-DD  (défaut : aujourd'hui, tz Paris)
 *
 * Sources agrégées :
 *  - NBA + WNBA : services ESPN (scoreboard daté, fix P0 Accept-Encoding identity)
 *  - EuroLeague + EuroCup : bridge euroleague_api partagé (euroleague-bridge.ts)
 *  - FIBA : ESPN fiba scoreboard (même cache que /api/fiba/scoreboard)
 *
 * Cache multi-worker 5 min par date (globalThis, pattern cached-route.ts) ;
 * si toutes les sources sont vides, sert le stale plutôt que le vide.
 */

import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { normalizeEvent, type FibaMatch } from "@/app/api/fiba/scoreboard/route";
import { fetchEuroGames } from "@/lib/euroleague-bridge";
import {
  buildBasketballCalendar,
  parisDateKeyOf,
  type EspnBbMatch,
  type EuroBbMatch,
} from "@/lib/basketball-calendar";
import { shiftDateKey } from "@/lib/fotmob-filter";
import type { FotmobCalMatch } from "@/components/football/fotmob-calendar-table";

type CalPayload = {
  date: string;
  matches: FotmobCalMatch[];
  sources: Record<string, number>;
  generatedAt: string;
};

const CACHE_TTL = 5 * 60_000;
const ESPN_FIBA_SCOREBOARD = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard";

// Cache multi-worker par date sur globalThis (cf. cached-route.ts).
type Entry = { data: CalPayload; at: number };
const g = globalThis as unknown as { __bbCalendarCache?: Map<string, Entry> };
const cacheMap = (g.__bbCalendarCache ??= new Map<string, Entry>());

/** FIBA : mêmes clé/TTL que /api/fiba/scoreboard → cache partagé entre les 2 routes. */
async function fetchFibaMatches(yyyymmdd: string): Promise<FibaMatch[]> {
  try {
    const cfg = fibaCache.scoreboard(yyyymmdd);
    const hit = cache.get<{ matches: FibaMatch[] }>(cfg.key);
    if (hit?.matches) return hit.matches;
    const res = await fetch(`${ESPN_FIBA_SCOREBOARD}?dates=${yyyymmdd}`, {
      headers: { "User-Agent": "PariScore/1.0" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const events: unknown[] = Array.isArray(json?.events) ? json.events : [];
    const matches = events.map((e) => normalizeEvent(e as Parameters<typeof normalizeEvent>[0]));
    cache.set(cfg.key, { matches, season: json?.leagues?.[0]?.season?.year ?? 2026, calendar: json?.leagues?.[0]?.calendar ?? [], source: "espn-fiba" }, cfg.ttl);
    return matches;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") || "";
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : parisDateKeyOf(Date.now());
  const yyyymmdd = dateKey.replaceAll("-", "");

  const fresh = cacheMap.get(dateKey);
  if (fresh && Date.now() - fresh.at < CACHE_TTL) {
    return NextResponse.json(fresh.data);
  }

  // Off-by-one Paris/US (fix prod 2026-09-29) : ESPN `?dates=D` indexe par jour
  // US — un match à 23:00Z du D est déjà le jour D+1 à Paris. On fetch D ET D-1,
  // le filtre date Paris de buildBasketballCalendar garde les bons (dédup par id).
  const prevYyyymmdd = shiftDateKey(dateKey, -1).replaceAll("-", "");

  // Saison euro dynamique : la saison YYYY court d'octobre YYYY à juin YYYY+1.
  const now = new Date();
  const euroSeason = now.getMonth() >= 7 ? String(now.getFullYear()) : String(now.getFullYear() - 1);

  // Les services ESPN résolvent [] en cas d'erreur (httpsGetJson → null) ;
  // le bridge euro résout { games: [], error } ; fetchFiba résout [].
  const svc = {
    // require des services CommonJS legacy — override eslint src/app/api/basketball/** (cf. eslint.config.mjs)
    nba: require("../../../../../services/basketballService") as { getNbaMatches: (d?: string) => Promise<EspnBbMatch[]> },
    wnba: require("../../../../../services/wnbaService") as { getWnbaMatches: (d?: string) => Promise<EspnBbMatch[]> },
  };
  const [nba, nbaPrev, wnba, wnbaPrev, euro, cup, fiba, fibaPrev] = await Promise.all([
    svc.nba.getNbaMatches(yyyymmdd).catch(() => [] as EspnBbMatch[]),
    svc.nba.getNbaMatches(prevYyyymmdd).catch(() => [] as EspnBbMatch[]),
    svc.wnba.getWnbaMatches(yyyymmdd).catch(() => [] as EspnBbMatch[]),
    svc.wnba.getWnbaMatches(prevYyyymmdd).catch(() => [] as EspnBbMatch[]),
    fetchEuroGames("euroleague", euroSeason).catch(() => ({ games: [] as EuroBbMatch[], error: "bridge" })),
    fetchEuroGames("eurocup", euroSeason).catch(() => ({ games: [] as EuroBbMatch[], error: "bridge" })),
    fetchFibaMatches(yyyymmdd),
    fetchFibaMatches(prevYyyymmdd),
  ]);

  const matches = buildBasketballCalendar(dateKey, {
    nba: [...(nba ?? []), ...(nbaPrev ?? [])],
    wnba: [...(wnba ?? []), ...(wnbaPrev ?? [])],
    euroleague: euro.games,
    eurocup: cup.games,
    fiba: [...fiba, ...fibaPrev],
  });

  const data: CalPayload = {
    date: dateKey,
    matches,
    sources: {
      nba: (nba?.length ?? 0) + (nbaPrev?.length ?? 0),
      wnba: (wnba?.length ?? 0) + (wnbaPrev?.length ?? 0),
      euroleague: euro.games.length,
      eurocup: cup.games.length,
      fiba: fiba.length + fibaPrev.length,
    },
    generatedAt: new Date().toISOString(),
  };

  // Toutes sources vides + cache stale dispo → stale (un blip réseau ne vide
  // jamais le calendrier, règle éprouvée sur /api/nba/matches).
  if (matches.length === 0 && fresh) {
    return NextResponse.json(fresh.data);
  }

  cacheMap.set(dateKey, { data, at: Date.now() });
  return NextResponse.json(data);
}
