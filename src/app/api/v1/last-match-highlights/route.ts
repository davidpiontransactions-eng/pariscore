import { NextRequest, NextResponse } from "next/server";
import { getLastMatchHighlights } from "@/services/last-match-highlights-service";

/**
 * GET /api/v1/last-match-highlights?playerA=...&playerB=...&tournament=...
 *
 * Highlights du dernier match joué par les 2 joueurs d'un duel — recherche
 * YouTube ciblée (H2H → joueur → tournoi), cache 48 h. Retourne toujours
 * 200 avec { highlights, meta } ; les champs null indiquent l'absence de
 * vidéo (pas une erreur) — l'UI masque alors le widget de lecture.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const playerA = url.searchParams.get("playerA");
  const playerB = url.searchParams.get("playerB");
  const tournament = url.searchParams.get("tournament");

  if (!playerA || !playerB) {
    return NextResponse.json(
      { error: "playerA and playerB are required" },
      { status: 400 },
    );
  }
  if (playerA.length > 80 || playerB.length > 80 || (tournament?.length ?? 0) > 100) {
    return NextResponse.json({ error: "params too long" }, { status: 400 });
  }

  const highlights = await getLastMatchHighlights({
    playerA,
    playerB,
    tournamentName: tournament || null,
  });

  const hasAny =
    highlights.h2h ?? highlights.playerA ?? highlights.playerB ?? highlights.tournament;

  return NextResponse.json({
    highlights,
    source: highlights.source,
    // null → pas de vidéo → le widget ne se monte pas.
    featured: hasAny ?? null,
    meta: { ttlSeconds: 48 * 60 * 60 },
  });
}