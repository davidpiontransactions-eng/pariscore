import { NextResponse, type NextRequest } from "next/server";
import { getMatchDetailPayload } from "@/lib/baseball/data/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/baseball/match/[id]
 * Feuille de match complète : sabermétrique + moteur Monte Carlo 10 000
 * itérations (résultat servi depuis le cache PostgreSQL par inputHash).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Identifiant de match invalide." }, { status: 400 });
  }
  try {
    const detail = await getMatchDetailPayload(id);
    if (!detail) {
      return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
    }
    return NextResponse.json({ detail }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[baseball/match]", error);
    return NextResponse.json({ error: "Analyse indisponible — réessayez." }, { status: 502 });
  }
}
