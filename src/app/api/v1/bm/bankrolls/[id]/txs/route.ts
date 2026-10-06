import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBmSession } from "@/lib/bet-manager/auth";

export const dynamic = "force-dynamic";

const KINDS = ["deposit", "withdrawal", "bonus", "adjustment"] as const;

// GET /api/v1/bm/bankrolls/:id/txs — ledger des mouvements de fonds
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireBmSession();
  if (deny) return deny;
  const { id } = await params;
  try {
    const txs = await prisma.bankrollTx.findMany({
      where: { bankrollId: id },
      orderBy: { at: "desc" },
    });
    return NextResponse.json({ txs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// POST /api/v1/bm/bankrolls/:id/txs — enregistrer un mouvement
// Normalisation du signe : deposit/bonus toujours positifs, withdrawal toujours
// négatif, adjustment laissé signé (correction manuelle).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireBmSession();
  if (deny) return deny;
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const kind = KINDS.includes(body?.kind) ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "kind invalide (deposit|withdrawal|bonus|adjustment)" }, { status: 400 });
  const raw = typeof body.amount === "number" ? body.amount : NaN;
  if (!isFinite(raw) || raw === 0) return NextResponse.json({ error: "amount invalide" }, { status: 400 });
  const amount =
    kind === "withdrawal" ? -Math.abs(raw) : kind === "adjustment" ? raw : Math.abs(raw);

  const bankroll = await prisma.bankroll.findUnique({ where: { id } });
  if (!bankroll) return NextResponse.json({ error: "Bankroll introuvable" }, { status: 404 });

  try {
    const tx = await prisma.bankrollTx.create({
      data: {
        bankrollId: id,
        kind,
        amount,
        at: typeof body.at === "string" && body.at ? new Date(body.at) : new Date(),
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null,
      },
    });
    return NextResponse.json({ tx }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}
