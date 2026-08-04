/**
 * GET /api/v2/matches — Liste des matchs (Prisma).
 *
 * Query params:
 *   ?sport=football|tennis  — filtre par sport
 *   ?status=scheduled|live|ft — filtre par statut
 *   ?limit=20               — max résultats (défaut 50)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport;
    if (status) where.status = status;

    const matches = await prisma.match.findMany({
      where,
      include: {
        home: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        away: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        league: { select: { id: true, name: true, country: true, logo: true } },
        odds: { select: { bookmaker: true, home: true, draw: true, away: true, movement: true }, take: 5 },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });

    return NextResponse.json({ matches, total: matches.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
