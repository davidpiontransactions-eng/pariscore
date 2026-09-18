import { NextResponse, type NextRequest } from "next/server";
import { getFlashscorePayload } from "@/lib/rugby/provider";

/** GET /api/rugby/flashscore?slug=top-14
 * Récupère les données Flashscore pour le Top 14 en fallback.
 * Renvoie les matchs formatés ou null si ESPN est récent.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { error: "Paramètre `slug` requis" },
      { status: 400 }
    );
  }

  try {
    const payload = await getFlashscorePayload(slug);
    return NextResponse.json(payload ?? { matches: [], source: 'flashscore' }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[rugby/flashscore]", error);
    return NextResponse.json(
      { error: "Erreur récupération Flashscore" },
      { status: 502 }
    );
  }
}