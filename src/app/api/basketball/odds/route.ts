import { NextRequest, NextResponse } from "next/server";
import { fetchBasketballOdds, fetchOddsHistory } from "@/lib/basketball-odds";
import { cache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";

// Fix audit 2026-09-23 : route = pass-through API payant sans rate-limit ni
// cache → quota 500 req/mo brûlé par les polls dialog. Port du pattern FIBA.
const ALLOWED_LEAGUES = new Set([
  "nba",
  "wnba",
  "euroleague",
  "eurocup",
  "ncaa",
  "nbl",
  "fiba",
]);
const ODDS_TTL = 5 * 60_000;
const HISTORY_TTL = 10 * 60_000;

export async function GET(request: NextRequest) {
  // Rate limiting (quota partagé The Odds API)
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitResult = rateLimits.odds(`bb-odds:${ip}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetAt.toString(),
        },
      },
    );
  }
  const rateHeaders = {
    "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
  };

  const searchParams = request.nextUrl.searchParams;
  const league = (searchParams.get("league") ?? "nba").toLowerCase();
  const homeTeam = searchParams.get("home") ?? "";
  const awayTeam = searchParams.get("away") ?? "";
  const history = searchParams.get("history") === "true";

  if (!ALLOWED_LEAGUES.has(league)) {
    return NextResponse.json(
      { error: "Invalid league", details: `allowed: ${[...ALLOWED_LEAGUES].join(", ")}` },
      { status: 400 },
    );
  }
  if (!homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: "home and away query params required" },
      { status: 400 },
    );
  }

  // Cache serveur clé sans clé API (le Data Cache Next ne doit jamais voir ODDS_API_KEY)
  const cacheKey = `bb:odds:${history ? "h" : "o"}:${league}:${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached as object, { headers: rateHeaders });
  }

  const data = history
    ? { snapshots: await fetchOddsHistory(league, homeTeam, awayTeam) }
    : { odds: await fetchBasketballOdds(league, homeTeam, awayTeam) };
  cache.set(cacheKey, data, history ? HISTORY_TTL : ODDS_TTL);
  return NextResponse.json(data, { headers: rateHeaders });
}
