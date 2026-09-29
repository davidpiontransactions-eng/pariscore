/**
 * API route pour les matchs EuroLeague/EuroCup.
 * Bridge euroleague_api (Python) via src/lib/euroleague-bridge.ts (partagé
 * avec /api/basketball/calendar). GET /api/euroleague/matches?league=euroleague&season=2025
 *
 * Fix P1 2026-09-29 : cache multi-worker 5 min (pattern createTtlCache, cf.
 * /api/nba/matches) — le bridge Python (~1-3 s) était appelé à chaque poll SWR.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchEuroGames, type EuroLeagueGame } from "@/lib/euroleague-bridge";

type Payload = { games: EuroLeagueGame[]; error?: string };

const CACHE_TTL = 5 * 60_000;

// Cache multi-worker par clé "league:season" sur globalThis (cf. cached-route.ts).
type Entry = { data: Payload; at: number };
const g = globalThis as unknown as { __euroleagueMatchesCache?: Map<string, Entry> };
const cacheMap = (g.__euroleagueMatchesCache ??= new Map<string, Entry>());

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") || "euroleague";
  const seasonRaw = searchParams.get("season") || "2025";
  // Garde : la saison est interpolée dans un script Python → digits uniquement.
  const season = /^\d{4}$/.test(seasonRaw) ? seasonRaw : "2025";

  if (!["euroleague", "eurocup"].includes(league)) {
    return NextResponse.json({ error: "Invalid league. Must be euroleague or eurocup." }, { status: 400 });
  }

  const key = `${league}:${season}`;
  const cached = cacheMap.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const result = await fetchEuroGames(league as "euroleague" | "eurocup", season);

  // Réponse exploitable (au moins des matchs, sans erreur bridge) → cache 5 min.
  // Une erreur bridge n'est PAS cachée : le prochain poll retente.
  if (!result.error || result.games.length > 0) {
    cacheMap.set(key, { data: result, at: Date.now() });
  }

  return NextResponse.json(result);
}
