/**
 * GET /api/v2/matches/live — Matchs en direct (Prisma).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      where: { status: "live" },
      include: {
        home: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        away: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        league: { select: { id: true, name: true, country: true, logo: true } },
        prediction: true,
        odds: { select: { bookmaker: true, home: true, draw: true, away: true, movement: true }, take: 8 },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ matches, total: matches.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
