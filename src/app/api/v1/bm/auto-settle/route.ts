import { NextRequest, NextResponse } from "next/server";
import { autoSettleBets } from "@/lib/bet-manager/auto-settle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/v1/bm/auto-settle — résout les paris pending via API-Football
// Body: { bankrollId?: string } ; header/query token optionnel (cron)
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* body vide autorisé */
  }

  // Autorisation : token cron si fourni, sinon requête authentifiée côté app (single-user)
  const token = req.nextUrl.searchParams.get("token");
  if (token && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  try {
    const result = await autoSettleBets(typeof body.bankrollId === "string" ? body.bankrollId : undefined);
    return NextResponse.json({
      ok: true,
      checked: result.checked,
      settled: result.settled.length,
      unresolved: result.unresolved.length,
      details: { settled: result.settled, unresolved: result.unresolved },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

// GET avec token → usage cron
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Token requis" }, { status: 401 });
  }
  try {
    const result = await autoSettleBets();
    return NextResponse.json({ ok: true, checked: result.checked, settled: result.settled.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}