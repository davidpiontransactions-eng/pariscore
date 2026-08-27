import { NextRequest, NextResponse } from "next/server";
import { getLiveOddsBySmid } from "@/lib/oddalerts/live-odds-db";
import { PRIORITY_MARKETS, marketTitleFr, formatOdds, freshnessClass } from "@/lib/oddalerts/live-odds-types";

// Détails live odds pour un match (SMID)
// GET /api/v1/oddalerts/live/game/[smid]

const CACHE_TTL = 5_000; // 5s cache

const _cache = new Map<string, { at: number; data: unknown }>();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ smid: string }> }
) {
  const { smid } = await params;
  const smidNum = parseInt(smid, 10);

  if (isNaN(smidNum)) {
    return NextResponse.json({ error: 'Invalid SMID' }, { status: 400 });
  }

  const key = `game-${smidNum}`;

  let entry = _cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL) {
    const markets = getLiveOddsBySmid(smidNum);

    if (markets.length === 0) {
      return NextResponse.json({ error: `No live odds for SMID ${smidNum}` }, { status: 404 });
    }

    // Prendre les infos du premier marché (tous ont les mêmes infos match)
    const first = markets[0];

    // Trier les marchés par priorité
    const sortedMarkets = [...markets].sort((a, b) => {
      const ai = PRIORITY_MARKETS.indexOf(a.marketTitle);
      const bi = PRIORITY_MARKETS.indexOf(b.marketTitle);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const enriched = sortedMarkets.map(m => ({
      ...m,
      titleFr: marketTitleFr(m.marketTitle as string),
      oddsFormatted: formatOdds(m.odds),
      dataFreshness: freshnessClass(m.dataAgeSeconds),
      oddsFreshness: freshnessClass(m.oddsAgeSeconds),
    }));

    entry = {
      at: Date.now(),
      data: {
        smid: smidNum,
        matchId: first.matchId,
        homeGoals: first.homeGoals,
        awayGoals: first.awayGoals,
        elapsed: first.elapsed,
        status: first.gameStatus,
        dataAgeSeconds: first.dataAgeSeconds,
        oddsAgeSeconds: first.oddsAgeSeconds,
        serverTime: first.serverTime,
        oddsUpdatedAt: first.oddsUpdatedAt,
        markets: enriched,
      },
    };
    _cache.set(key, entry);
  }

  return NextResponse.json(
    { game: entry?.data },
    { headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=15" } }
  );
}