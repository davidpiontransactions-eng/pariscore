import { NextRequest, NextResponse } from "next/server";
import { autoSettleBets } from "@/lib/bet-manager/auto-settle";
import { requireBmSession } from "@/lib/bet-manager/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Token cron valide OU session utilisateur (l'UI appelle sans token : c'était le 401). */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const token = req.nextUrl.searchParams.get("token");
  if (token && token === process.env.CRON_SECRET) return null;
  return requireBmSession();
}

// POST /api/v1/bm/auto-settle — résout les paris pending via API-Football
// Body: { bankrollId?: string} ; token cron (pm2) OU session (UI)
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* body vide autorisé */
  }

  const deny = await authorize(req);
  if (deny) return deny;

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

// GET — usage cron (token) ou test depuis l'UI (session)
export async function GET(req: NextRequest) {
  const deny = await authorize(req);
  if (deny) return deny;
  try {
    const result = await autoSettleBets();
    return NextResponse.json({ ok: true, checked: result.checked, settled: result.settled.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}