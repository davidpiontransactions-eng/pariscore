import { NextResponse, type NextRequest } from "next/server";
import { COMPETITION_BY_SLUG } from "@/lib/rugby/competitions";
import { getMatchDetailPayload } from "@/lib/rugby/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/match?slug=six-nations&id=123456
 * Détail complet d'un match : prédiction, ratings, H2H, marqueurs d'essai.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").toLowerCase();
  const id = searchParams.get("id") ?? "";

  if (!slug || !COMPETITION_BY_SLUG.has(slug)) {
    return NextResponse.json(
      { error: "Paramètre `slug` invalide — voir /api/rugby/competitions." },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: "Paramètre `id` manquant." }, { status: 400 });
  }

  try {
    const payload = await getMatchDetailPayload(slug, id);
    if (!payload) {
      return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[rugby/match]", error);
    return NextResponse.json(
      { error: "Pipeline rugby indisponible — réessayez." },
      { status: 502 }
    );
  }
}
