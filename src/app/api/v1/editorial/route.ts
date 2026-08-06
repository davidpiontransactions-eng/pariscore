import { NextRequest, NextResponse } from "next/server";
import { getEditorialSummary, type EditorialSummary } from "@/lib/scraping/editorial-scraper-service";

/**
 * GET /api/v1/editorial?sport=tennis&matchId=xyz&playerA=...&playerB=...
 *
 * Résumé éditorial (2-3 phrases) d'un duel — cache 24h côté service
 * (globalThis + fichier .cache/editorial/). Retourne 404 si aucun article
 * éditorial fiable n'est trouvé (pas une erreur).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sport = url.searchParams.get("sport");
  const matchId = url.searchParams.get("matchId");
  const playerA = url.searchParams.get("playerA");
  const playerB = url.searchParams.get("playerB");
  const tournament = url.searchParams.get("tournament") ?? undefined;

  if (sport !== "tennis" && sport !== "football") {
    return NextResponse.json(
      { error: "sport must be 'tennis' or 'football'" },
      { status: 400 },
    );
  }
  if (!matchId || !playerA || !playerB) {
    return NextResponse.json(
      { error: "matchId, playerA and playerB are required" },
      { status: 400 },
    );
  }
  // Garde-fou taille : jamais de noms interminables.
  if (playerA.length > 80 || playerB.length > 80 || matchId.length > 120) {
    return NextResponse.json({ error: "params too long" }, { status: 400 });
  }

  const summary: EditorialSummary | null = await getEditorialSummary({
    sport,
    matchId,
    playerAName: playerA,
    playerBName: playerB,
    tournamentName: tournament,
  });

  if (!summary) {
    return NextResponse.json({ summary: null }, { status: 200 });
  }

  return NextResponse.json({
    summary,
    meta: {
      ttlSeconds: 24 * 60 * 60,
    },
  });
}
