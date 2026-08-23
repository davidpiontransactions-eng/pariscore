import { NextRequest, NextResponse } from "next/server";
import { countByCountry, listLeagues } from "@/lib/leagues-stats/db";
import type { CountryGroup, LeagueIndexEntry } from "@/lib/leagues-stats/types";

// Index des ligues scrapées d'OddAlerts (table league_season_stats, pariscore.db).
// Cache mémoire 30 min : les données ne bougent qu'une fois par jour (cron 04:30 UTC).

const CACHE_TTL = 30 * 60_000;

let _cache: {
  at: number;
  leagues: LeagueIndexEntry[];
  countries: CountryGroup[];
} | null = null;

export async function GET(req: NextRequest) {
  const country = new URL(req.url).searchParams.get("country");

  if (!_cache || Date.now() - _cache.at > CACHE_TTL) {
    _cache = { at: Date.now(), leagues: listLeagues(), countries: countByCountry() };
  }

  if (!_cache.leagues.length) {
    return NextResponse.json(
      { error: "Stats de ligues indisponibles (base non initialisée)" },
      { status: 503 }
    );
  }

  const leagues = country
    ? _cache.leagues.filter((l) => l.country === country)
    : _cache.leagues;

  return NextResponse.json(
    {
      total: leagues.length,
      countries: _cache.countries,
      leagues,
      generatedAt: new Date(_cache.at).toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } }
  );
}
