import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/v1/bm/bets?bankrollId=&status=&sport=&search=&limit=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bankrollId = sp.get("bankrollId");
  const status = sp.get("status");
  const sport = sp.get("sport");
  const search = sp.get("search")?.trim();
  const limit = Math.min(500, parseInt(sp.get("limit") ?? "200", 10) || 200);

  const where: any = {};
  if (bankrollId) where.bankrollId = bankrollId;
  if (status && status !== "all") where.status = status;
  if (sport && sport !== "all") where.sport = sport;
  if (search) {
    where.OR = [
      { matchLabel: { contains: search } },
      { pick: { contains: search } },
      { competition: { contains: search } },
      { bookmaker: { contains: search } },
      { tipster: { contains: search } },
    ];
  }

  try {
    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        orderBy: { placedAt: "desc" },
        take: limit,
        include: { legs: { orderBy: { order: "asc" } } },
      }),
      prisma.bet.count({ where }),
    ]);
    return NextResponse.json({ bets, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// POST /api/v1/bm/bets — créer un pari (simple, combo, system, back, lay, dutch)
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const bankrollId = typeof body.bankrollId === "string" ? body.bankrollId : null;
  if (!bankrollId) return NextResponse.json({ error: "bankrollId requis" }, { status: 400 });
  const stake = typeof body.stake === "number" && body.stake > 0 ? body.stake : null;
  if (!stake) return NextResponse.json({ error: "stake invalide" }, { status: 400 });

  const betType = ["single", "combo", "system", "back", "lay", "dutch"].includes(body.betType) ? body.betType : "single";
  const status = ["pending", "won", "lost", "void", "cashout"].includes(body.status) ? body.status : "pending";
  const odds = typeof body.odds === "number" && body.odds > 0 ? body.odds : 1;

  const legs = Array.isArray(body.legs)
    ? body.legs
        .filter((l: any) => l && typeof l.matchLabel === "string" && l.matchLabel.trim())
        .slice(0, 50)
        .map((l: any, i: number) => ({
          matchLabel: l.matchLabel.trim(),
          market: typeof l.market === "string" ? l.market : null,
          pick: typeof l.pick === "string" ? l.pick : null,
          odds: typeof l.odds === "number" && l.odds > 0 ? l.odds : 1,
          order: i,
        }))
    : [];

  const payout =
    typeof body.payout === "number" && !isNaN(body.payout)
      ? body.payout
      : status === "won"
        ? stake * odds
        : status === "void" || status === "cashout"
          ? stake
          : null;

  try {
    const bet = await prisma.bet.create({
      data: {
        bankrollId,
        betType,
        sport: typeof body.sport === "string" && body.sport ? body.sport : "football",
        competition: typeof body.competition === "string" ? body.competition : null,
        matchLabel: typeof body.matchLabel === "string" ? body.matchLabel : null,
        market: typeof body.market === "string" ? body.market : null,
        pick: typeof body.pick === "string" ? body.pick : null,
        stake,
        odds,
        status,
        payout,
        profit: payout !== null ? payout - stake : null,
        cashoutAt: status === "cashout" ? new Date().toISOString() : null,
        bookmaker: typeof body.bookmaker === "string" ? body.bookmaker : null,
        tipster: typeof body.tipster === "string" ? body.tipster : null,
        category: typeof body.category === "string" ? body.category : null,
        tags: typeof body.tags === "string" ? body.tags : undefined,
        closingOdd: typeof body.closingOdd === "number" ? body.closingOdd : null,
        placedAt: typeof body.placedAt === "string" ? new Date(body.placedAt) : new Date(),
        settledAt: status !== "pending" ? new Date() : null,
        note: typeof body.note === "string" ? body.note : null,
        legs: { create: legs },
      },
      include: { legs: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ bet }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}