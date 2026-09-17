import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/odds-archive?matchId=...&market=...&league=...&from=...&to=...
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const matchId = sp.get("matchId");
  const market = sp.get("market") ?? "1X2";
  const league = sp.get("league");
  const from = sp.get("from");
  const to = sp.get("to");
  const source = sp.get("source") ?? "bsd-compare";

  if (!matchId && !league) {
    return NextResponse.json(
      { error: "matchId ou league requis" },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = { source, market };

  if (matchId) where.matchId = matchId;
  if (league) where.league = league;
  if (from || to) {
    where.scrapedAt = {};
    if (from) (where.scrapedAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.scrapedAt as Record<string, Date>).lte = new Date(to);
  }

  const snapshots = await prisma.oddsSnapshot.findMany({
    where,
    orderBy: { scrapedAt: "asc" },
    take: 500,
    select: {
      matchId: true,
      bookmaker: true,
      market: true,
      outcome: true,
      odds: true,
      impliedProb: true,
      scrapedAt: true,
    },
  });

  // Grouper par matchId → timeline
  const grouped = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const arr = grouped.get(s.matchId) ?? [];
    arr.push(s);
    grouped.set(s.matchId, arr);
  }

  return NextResponse.json({
    total: snapshots.length,
    matches: grouped.size,
    snapshots,
  });
}
