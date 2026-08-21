import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/v1/bm/bankrolls — liste des bankrolls avec stats légères
export async function GET() {
  try {
    const bankrolls = await prisma.bankroll.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { bets: true } } },
    });
    return NextResponse.json({ bankrolls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// POST /api/v1/bm/bankrolls — créer une bankroll
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
  const initial = typeof body.initial === "number" && !isNaN(body.initial) ? body.initial : 0;
  const currency = typeof body.currency === "string" && body.currency ? body.currency : "EUR";
  try {
    const bankroll = await prisma.bankroll.create({
      data: { name, initial, currency, note: typeof body.note === "string" ? body.note : null },
    });
    return NextResponse.json({ bankroll }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}