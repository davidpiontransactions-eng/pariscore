import { NextRequest, NextResponse } from "next/server";
import {
  getMatchHighlights,
  type MatchHighlights,
} from "@/lib/scraping/tennistv-highlights-service";

/**
 * GET /api/v1/tennistv-highlights?playerA=...&playerB=...
 *
 * Dernier highlight TennisTV (YouTube) pour chacune des 2 joueurs d'un
 * duel — cache 24 h côté service (globalThis + .cache/tennistv/). Retourne
 * { highlights: { playerA, playerB } } ; chaque côté est null s'il n'existe
 * pas de vidéo récente mentionnant le joueur (pas une erreur).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const playerA = url.searchParams.get("playerA");
  const playerB = url.searchParams.get("playerB");

  if (!playerA || !playerB) {
    return NextResponse.json(
      { error: "playerA and playerB are required" },
      { status: 400 },
    );
  }
  // Garde-fou taille : jamais de noms interminables dans une requête.
  if (playerA.length > 80 || playerB.length > 80) {
    return NextResponse.json({ error: "params too long" }, { status: 400 });
  }

  const highlights: MatchHighlights = await getMatchHighlights(
    playerA,
    playerB,
  );

  if (!highlights.playerA && !highlights.playerB) {
    return NextResponse.json({ highlights: null }, { status: 200 });
  }

  return NextResponse.json({
    highlights,
    meta: { ttlSeconds: 24 * 60 * 60 },
  });
}