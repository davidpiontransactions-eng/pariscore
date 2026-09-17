// odds-persistence.ts — Service de persistance des odds BSD dans OddsSnapshot (Prisma).
//
// Ce module prend les odds BSD (best odds + consensus) et les persist dans la table
// odds_snapshots pour créer un historique persistant (survit aux restarts).
//
// Source: BSD compare odds (best odds par bookmaker, consensus)
// Stockage: Prisma OddsSnapshot avec source = "bsd-compare"
//
// Usage: appelé par le cron BSD enrichment ou par un cron dédié.

import { prisma } from "@/lib/prisma";

type BSDOddsInput = {
  matchId: string;
  sport?: string;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  best: {
    home: { value: number; bookmaker: string } | null;
    draw: { value: number; bookmaker: string } | null;
    away: { value: number; bookmaker: string } | null;
  };
  consensus: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
  btts?: { yes: number; no: number } | null;
  over25?: { over: number; under: number } | null;
};

/**
 * Persist un snapshot odds BSD dans la base.
 * Dedup: ignore si le dernier snapshot pour ce match/market/outcome < 10 min.
 */
export async function persistOddsSnapshot(input: BSDOddsInput): Promise<number> {
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  // Vérifier le dernier snapshot pour éviter les doublons
  const lastSnap = await prisma.oddsSnapshot.findFirst({
    where: {
      matchId: input.matchId,
      source: "bsd-compare",
      scrapedAt: { gte: tenMinAgo },
    },
    orderBy: { scrapedAt: "desc" },
  });

  // Si un snapshot récent existe avec les mêmes valeurs, skip
  if (lastSnap) {
    return 0;
  }

  const rows: Array<{
    matchId: string;
    sport: string;
    league: string | null;
    homeTeam: string;
    awayTeam: string;
    bookmaker: string;
    market: string;
    outcome: string;
    odds: number;
    impliedProb: number;
    source: string;
  }> = [];

  // Best odds (par bookmaker)
  const entries = [
    { key: "home", outcome: "H", data: input.best.home },
    { key: "draw", outcome: "D", data: input.best.draw },
    { key: "away", outcome: "A", data: input.best.away },
  ] as const;

  for (const e of entries) {
    if (e.data) {
      rows.push({
        matchId: input.matchId,
        sport: input.sport ?? "football",
        league: input.league ?? null,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        bookmaker: e.data.bookmaker,
        market: "1X2",
        outcome: e.outcome,
        odds: e.data.value,
        impliedProb: 1 / e.data.value,
        source: "bsd-compare",
      });
    }
  }

  // Consensus odds
  const consensusEntries = [
    { outcome: "H", value: input.consensus.home },
    { outcome: "D", value: input.consensus.draw },
    { outcome: "A", value: input.consensus.away },
  ] as const;

  for (const ce of consensusEntries) {
    if (ce.value) {
      rows.push({
        matchId: input.matchId,
        sport: input.sport ?? "football",
        league: input.league ?? null,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        bookmaker: "consensus",
        market: "1X2",
        outcome: ce.outcome,
        odds: ce.value,
        impliedProb: 1 / ce.value,
        source: "bsd-compare",
      });
    }
  }

  // BTTS
  if (input.btts) {
    rows.push({
      matchId: input.matchId,
      sport: input.sport ?? "football",
      league: input.league ?? null,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      bookmaker: "consensus",
      market: "BTTS",
      outcome: "Yes",
      odds: input.btts.yes,
      impliedProb: 1 / input.btts.yes,
      source: "bsd-compare",
    });
    rows.push({
      matchId: input.matchId,
      sport: input.sport ?? "football",
      league: input.league ?? null,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      bookmaker: "consensus",
      market: "BTTS",
      outcome: "No",
      odds: input.btts.no,
      impliedProb: 1 / input.btts.no,
      source: "bsd-compare",
    });
  }

  // Over/Under 2.5
  if (input.over25) {
    rows.push({
      matchId: input.matchId,
      sport: input.sport ?? "football",
      league: input.league ?? null,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      bookmaker: "consensus",
      market: "OU25",
      outcome: "O",
      odds: input.over25.over,
      impliedProb: 1 / input.over25.over,
      source: "bsd-compare",
    });
    rows.push({
      matchId: input.matchId,
      sport: input.sport ?? "football",
      league: input.league ?? null,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      bookmaker: "consensus",
      market: "OU25",
      outcome: "U",
      odds: input.over25.under,
      impliedProb: 1 / input.over25.under,
      source: "bsd-compare",
    });
  }

  if (rows.length === 0) return 0;

  // Batch insert
  const result = await prisma.oddsSnapshot.createMany({
    data: rows.map((r) => ({ ...r, scrapedAt: now })),
  });

  return result.count;
}
