import { NextRequest, NextResponse } from "next/server";
import {
  getMatchEditorial,
  type MatchEditorialResult,
} from "@/lib/match-editorial-service";

/**
 * GET /api/v1/editorial?sport=tennis&matchId=xyz&playerA=...&playerB=...&lang=fr
 *
 * Analyse éditoriale prédictive d'un duel — pipeline 4 étapes (scraper editorial
 * whitelist → traduction EN→FR si lang=fr → cache 24h mémoire+disque).
 * Retourne `summary: null` si aucun article éditorial fiable n'est trouvé (200, pas une erreur).
 *
 * lang: "fr" (défaut) | "en" — toute autre locale est servie en anglais.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sport = url.searchParams.get("sport");
  const matchId = url.searchParams.get("matchId");
  const playerA = url.searchParams.get("playerA");
  const playerB = url.searchParams.get("playerB");
  const tournament = url.searchParams.get("tournament") ?? undefined;
  const rawLang = url.searchParams.get("lang") ?? "fr";

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

  const lang = rawLang === "en" ? "en" : "fr";

  const result: MatchEditorialResult = await getMatchEditorial(
    {
      sport,
      matchId,
      playerAName: playerA,
      playerBName: playerB,
      tournamentName: tournament,
    },
    lang,
  );

  if (result.status === "absent") {
    return NextResponse.json({ summary: null }, { status: 200 });
  }

  return NextResponse.json({
    summary: {
      text: result.text,
      source: result.source,
      url: result.url,
      translated: result.translated,
      fetchedAt: result.fetchedAt,
    },
    meta: {
      lang,
      translated: result.translated,
      ttlSeconds: 24 * 60 * 60,
    },
  });
}