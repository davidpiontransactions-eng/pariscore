import { NextResponse, type NextRequest } from "next/server";
import { COMPETITION_BY_SLUG } from "@/lib/rugby/competitions";
import { getBacktestStatsPayload } from "@/lib/rugby/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/backtest?slug=six-nations  (slug optionnel → toutes compétitions)
 * Couverture du spread par bande de probabilité domicile, mesurée sur les
 * matchs terminés (snapshot de la ligne au moment de la prédiction).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").toLowerCase();

  if (slug && !COMPETITION_BY_SLUG.has(slug)) {
    return NextResponse.json(
      { error: "Paramètre `slug` invalide — voir /api/rugby/competitions." },
      { status: 400 }
    );
  }

  try {
    const payload = await getBacktestStatsPayload(slug || null);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[rugby/backtest]", error);
    return NextResponse.json(
      { error: "Pipeline rugby indisponible — réessayez." },
      { status: 502 }
    );
  }
}