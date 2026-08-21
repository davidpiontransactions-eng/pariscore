import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/bm/bankrolls/:id — détail bankroll
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const bankroll = await prisma.bankroll.findUnique({ where: { id } });
    if (!bankroll) return NextResponse.json({ error: "Bankroll introuvable" }, { status: 404 });
    return NextResponse.json({ bankroll });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// PATCH /api/v1/bm/bankrolls/:id — renommer, ajuster capital initial, note
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.initial === "number" && !isNaN(body.initial)) data.initial = body.initial;
  if (typeof body.currency === "string" && body.currency) data.currency = body.currency;
  if (typeof body.note === "string") data.note = body.note;
  try {
    const bankroll = await prisma.bankroll.update({ where: { id }, data });
    return NextResponse.json({ bankroll });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// DELETE /api/v1/bm/bankrolls/:id — supprime bankroll + ses paris
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.$transaction([
      prisma.bet.deleteMany({ where: { bankrollId: id } }),
      prisma.importBatch.deleteMany({ where: { bankrollId: id } }),
      prisma.bankroll.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}