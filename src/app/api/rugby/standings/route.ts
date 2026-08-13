import { NextResponse, type NextRequest } from "next/server";
import { COMPETITION_BY_SLUG } from "@/lib/rugby/competitions";
import { getStandingsPayload } from "@/lib/rugby/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/standings?slug=top-14
 * Classement (Elo, bilan, forme) + chances de titre simulées (Monte Carlo).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").toLowerCase();

  if (!slug || !COMPETITION_BY_SLUG.has(slug)) {
    return NextResponse.json(
      { error: "Paramètre `slug` invalide — voir /api/rugby/competitions." },
      { status: 400 }
    );
  }

  try {
    const payload = await getStandingsPayload(slug);
    if (!payload) {
      return NextResponse.json({ error: "Compétition introuvable." }, { status: 404 });
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[rugby/standings]", error);
    return NextResponse.json(
      { error: "Pipeline rugby indisponible — réessayez." },
      { status: 502 }
    );
  }
}
