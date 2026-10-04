import { NextRequest, NextResponse } from "next/server";
import { getMmaNews } from "@/lib/mma-news";

export const dynamic = "force-dynamic";

/**
 * Fil d'actu MMA/UFC traduit, avec photos.
 *
 * La traduction est faite côté serveur dans `getMmaNews` : la clé LLM ne doit
 * jamais atteindre le client. Si la traduction échoue, la réponse est un 200
 * avec les titres originaux et `translated: false` — un fil d'actu qui tombe
 * sur une erreur de quota ne doit pas casser l'onglet.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "fr-FR";
  const limit = Math.min(
    40,
    Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12),
  );

  try {
    const result = await getMmaNews(locale);
    return NextResponse.json({
      items: result.items.slice(0, limit),
      sources: result.sources,
      translated: result.translated,
      fetchedAt: result.fetchedAt,
    });
  } catch (err) {
    console.error("[mma/news]", err);
    return NextResponse.json(
      { items: [], sources: [], translated: false, error: "Fil d'actu indisponible" },
      { status: 503 },
    );
  }
}