import { NextRequest, NextResponse } from "next/server";
import { getLiveOddsSmids, getLiveGamesBasicInfo } from "@/lib/oddalerts/live-odds-db";
import { fetchLiveGames } from "@/lib/oddalerts/live-api";

// Liste des matchs live avec odds OddAlerts
// GET /api/v1/oddalerts/live/games
// Combine /latency/games (OddAlerts) + live_odds_oddalerts (DB locale)

const CACHE_TTL = 10_000; // 10s cache

const _cache = new Map<string, { at: number; data: unknown }>();

export async function GET(_req: NextRequest) {
  const key = 'live-games';

  let entry = _cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL) {
    try {
      // 1. Récupérer la liste depuis OddAlerts API (source de vérité pour noms équipes, score, minute)
      const gamesResp = await fetchLiveGames();
      const games = gamesResp.games || [];

      // 2. Filtrer ceux qu'on a en DB (qui ont des live odds)
      const dbSmids = getLiveOddsSmids();
      const dbSmidsSet = new Set(dbSmids);

      // 3. Combiner
      const combined = games
        .filter(g => dbSmidsSet.has(g.smid))
        .map(g => ({
          smid: g.smid,
          id: g.id,
          home_name: g.home_name,
          away_name: g.away_name,
          home_goals: g.home_goals,
          away_goals: g.away_goals,
          elapsed: g.elapsed,
          status: g.status,
          ht_score: g.ht_score,
          ft_score: g.ft_score,
          updated: g.updated,
          league_name: g.league_name,
          unix: g.unix,
          hasOdds: true,
        }));

      entry = { at: Date.now(), data: combined };
      _cache.set(key, entry);
    } catch (err) {
      console.error('[oddalerts-live-games] Erreur:', err);
      return NextResponse.json({ error: 'Failed to fetch live games' }, { status: 500 });
    }
  }

  return NextResponse.json(
    { games: entry?.data },
    { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30" } }
  );
}