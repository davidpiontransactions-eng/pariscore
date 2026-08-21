import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBetsCSV } from "@/lib/bet-manager/calculators";

export const dynamic = "force-dynamic";

// POST /api/v1/bm/import/csv — import en masse { bankrollId, csv }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const bankrollId = typeof body.bankrollId === "string" ? body.bankrollId : null;
  const csv = typeof body.csv === "string" ? body.csv : null;
  if (!bankrollId || !csv) {
    return NextResponse.json({ error: "bankrollId et csv requis" }, { status: 400 });
  }

  const bankroll = await prisma.bankroll.findUnique({ where: { id: bankrollId } });
  if (!bankroll) return NextResponse.json({ error: "Bankroll introuvable" }, { status: 404 });

  const parsed = parseBetsCSV(csv);
  if (parsed.length === 0) return NextResponse.json({ error: "Aucun pari détecté dans le CSV" }, { status: 400 });

  try {
    const created = await prisma.$transaction(
      parsed.map((p) =>
        prisma.bet.create({
          data: {
            bankrollId,
            betType: "single",
            sport: p.sport ?? "football",
            competition: p.competition ?? null,
            matchLabel: p.matchLabel ?? null,
            market: p.market ?? null,
            pick: p.pick ?? null,
            stake: p.stake ?? 0,
            odds: p.odds ?? 1,
            status: (p.status as string) ?? "pending",
            payout: p.payout ?? null,
            profit: p.payout !== null && p.payout !== undefined ? p.payout - (p.stake ?? 0) : null,
            bookmaker: p.bookmaker ?? null,
            tipster: p.tipster ?? null,
            category: p.category ?? null,
            tags: p.tags ?? "",
            placedAt: new Date(p.placedAt ?? new Date()),
            settledAt: p.status && p.status !== "pending" ? new Date() : null,
            note: p.note ?? null,
          },
        })
      )
    );
    await prisma.importBatch.create({
      data: { bankrollId, source: "csv", fileName: typeof body.fileName === "string" ? body.fileName : null, count: created.length },
    });
    return NextResponse.json({ imported: created.length, bets: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}