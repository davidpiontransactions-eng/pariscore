import { NextRequest, NextResponse } from "next/server";
import {
  getPreviousRoundHighlights,
  mapSurfaceToken,
} from "@/services/previous-match-highlights-service";

const MAX_LEN = 120;

/**
 * GET /api/v1/previous-match-highlights
 *   ?matchId=bsd-33487&playerAId=11&playerAName=Iga%20Swiatek
 *   &playerBId=12&playerBName=Ons%20Jabeur&tournament=...&surface=...
 *
 * Highlights du tour précédent pour les 2 joueurs d'un duel tennis :
 * résout le dernier match réellement joué de chacun (BSD player_last5),
 * étiquette « Tour précédent » (même tournoi) / « Dernier match », et
 * cherche une vidéo YouTube (cascade adversaire+surface+tournoi+année).
 * Ne renvoie jamais 5xx : les champs null signalent l'absence de vidéo.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const g = (k: string) => url.searchParams.get(k);

  const matchId = g("matchId");
  const playerAId = g("playerAId");
  const playerAName = g("playerAName");
  const playerBId = g("playerBId");
  const playerBName = g("playerBName");
  const tournament = g("tournament");

  const required: Array<[string, string | null]> = [
    ["matchId", matchId],
    ["playerAId", playerAId],
    ["playerAName", playerAName],
    ["playerBId", playerBId],
    ["playerBName", playerBName],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return NextResponse.json({ error: `missing: ${missing.join(",")}` }, { status: 400 });
  }
  for (const [k, v] of required) {
    if ((v?.length ?? 0) > MAX_LEN) {
      return NextResponse.json({ error: `${k} too long` }, { status: 400 });
    }
  }

  const result = await getPreviousRoundHighlights({
    matchId: matchId!,
    playerAId: playerAId!,
    playerAName: playerAName!,
    playerBId: playerBId!,
    playerBName: playerBName!,
    currentTournamentName: tournament?.trim() || null,
    currentSurface: mapSurfaceToken(g("surface")),
  });

  return NextResponse.json({
    players: result.players,
    source: result.source,
    meta: { ttlSeconds: 172800 }, // 48 h
  });
}