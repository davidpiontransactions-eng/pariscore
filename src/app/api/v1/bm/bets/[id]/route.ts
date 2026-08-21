import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/v1/bm/bets/:id — régler un pari (status, payout), éditer, cashout
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const existing = await prisma.bet.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pari introuvable" }, { status: 404 });

  const data: any = {};
  const editable: (keyof typeof existing)[] = [
    "betType", "sport", "competition", "matchLabel", "market", "pick",
    "stake", "odds", "bookmaker", "tipster", "category", "tags", "closingOdd", "note", "placedAt",
  ];
  for (const k of editable) {
    if (body[k] !== undefined && body[k] !== null) data[k] = body[k] as never;
  }

  // Règlement d'un pari pending → won/lost/void/cashout
  if (body.status && ["won", "lost", "void", "cashout", "pending"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "pending") {
      data.payout = null;
      data.profit = null;
      data.settledAt = null;
      data.cashoutAt = null;
    } else {
      const stake = body.stake !== undefined ? Number(body.stake) : existing.stake;
      const odds = body.odds !== undefined ? Number(body.odds) : existing.odds;
      const payout =
        typeof body.payout === "number"
          ? body.payout
          : body.status === "won"
            ? stake * odds
            : body.status === "void" || body.status === "cashout"
              ? stake
              : 0;
      data.payout = payout;
      data.profit = payout - stake;
      data.settledAt = new Date().toISOString();
      data.cashoutAt = body.status === "cashout" ? new Date().toISOString() : null;
    }
  }

  try {
    const bet = await prisma.bet.update({
      where: { id },
      data,
      include: { legs: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ bet });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// DELETE /api/v1/bm/bets/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.$transaction([
      prisma.betLeg.deleteMany({ where: { betId: id } }),
      prisma.bet.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}