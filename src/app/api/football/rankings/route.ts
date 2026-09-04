import { NextResponse } from "next/server";
import {
  fdRanking,
  fdStandings,
  fdSeasons,
  FD_MARKETS,
  type FdMarketKey,
  type FdScope,
} from "@/lib/football-fd";
import { leagueXgRanking } from "@/lib/football-xg";

/**
 * GET /api/football/rankings?league=ligue1&season=2025/26&scope=overall
 *
 * Classements complets d'un championnat pour tous les marchés en un appel :
 * buts moyens, Over 1.5 / Under 3.5, BTTS, corners O6.5/O7.5/match, PPM
 * (source football-data.co.uk) + xG moyen et xG défensif moyen (Understat,
 * si la ligue est couverte).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league");
  if (!league) {
    return NextResponse.json({ error: "league requise" }, { status: 400 });
  }
  const scopeParam = url.searchParams.get("scope") ?? "overall";
  const scope: FdScope = ["overall", "home", "away"].includes(scopeParam)
    ? (scopeParam as FdScope)
    : "overall";

  const seasons = fdSeasons(league);
  if (!seasons.length && !leagueXgRanking(league, "2025/26", scope)) {
    return NextResponse.json({ error: "ligue indisponible" }, { status: 404 });
  }

  const season = url.searchParams.get("season") ?? seasons[0] ?? "2025/26";
  const higherBetter = Object.fromEntries(
    Object.entries(FD_MARKETS).map(([k, v]) => [k, v.higherBetter]),
  );

  const markets: Partial<Record<FdMarketKey | "xgFor" | "xgAgainst" | "standings", unknown>> = {};
  for (const key of Object.keys(FD_MARKETS) as FdMarketKey[]) {
    const rows = fdRanking(league, season, key, scope);
    if (rows) markets[key] = rows;
  }

  // xG offensif/défensif (Understat) — classement séparé car source distincte.
  const xgRows = leagueXgRanking(league, season, scope);
  if (xgRows?.length) {
    markets.xgFor = [...xgRows].sort((a, b) => b.xgFor - a.xgFor);
    markets.xgAgainst = [...xgRows].sort((a, b) => a.xgAgainst - b.xgAgainst);
  }

  // Classement complet (W/D/L/GF/GA/GD/PTS) — pour FootballRankingsEnhanced.
  const standings = fdStandings(league, season, scope);
  if (standings) markets.standings = standings;

  return NextResponse.json({
    league,
    season,
    scope,
    availableSeasons: seasons.length ? seasons : xgRows ? [season] : [],
    higherBetter,
    markets,
    meta: { computedAt: new Date().toISOString() },
  });
}
