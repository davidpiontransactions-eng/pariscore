import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBmSession } from "@/lib/bet-manager/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; txId: string }> };

// DELETE /api/v1/bm/bankrolls/:id/txs/:txId — annuler un mouvement du ledger
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const deny = await requireBmSession();
  if (deny) return deny;
  const { id, txId } = await params;
  try {
    const tx = await prisma.bankrollTx.findUnique({ where: { id: txId } });
    if (!tx || tx.bankrollId !== id) {
      return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
    }
    await prisma.bankrollTx.delete({ where: { id: txId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}
