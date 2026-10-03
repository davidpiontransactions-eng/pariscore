import { NextResponse } from "next/server";
import { getFootballMatches } from "@/lib/football-shared-fetcher";
import type { MetricRankings } from "@/lib/football-data";

/**
 * GET /api/football/metric-rankings?league=<leagueId>
 *
 * `prediction.metricRankings` pour UNE ligue, chargé à la demande.
 *
 * Pourquoi une route dédiée : ce champ pèse 62 Ko en moyenne et 1,7 Mo sur les
 * « Club Friendlies », et il est identique pour tous les matchs d'une même ligue
 * (mesuré : 48 valeurs distinctes pour 295 matchs). Le renvoyer dans
 * `/api/football/matches` le multipliait par 2 à 16 — 18,3 Mo sur 19,5 Mo de
 * réponse. Ici on le sort à la demande, une fois par ligue, uniquement quand
 * l'utilisateur ouvre l'onglet « Classements » d'un match.
 *
 * 200 `{ league, rankings }` · 400 sans `league` · 404 ligue sans classement.
 */
export async function GET(request: Request) {
  const league = new URL(request.url).searchParams.get("league");
  if (!league) {
    return NextResponse.json({ error: "league requise" }, { status: 400 });
  }

  try {
    const { entry } = await getFootballMatches();
    // Premier match de la ligue qui porte un classement : la table est
    // commune à tous ses matchs, le choix du premier est donc sans effet.
    const match = (entry.data.matches as { league?: { id?: string }; prediction?: { metricRankings?: MetricRankings } }[])
      .find((m) => m?.league?.id === league && m.prediction?.metricRankings);

    const rankings = match?.prediction?.metricRankings;
    if (!rankings) {
      return NextResponse.json({ error: "classement indisponible" }, { status: 404 });
    }

    return NextResponse.json(
      { league, rankings },
      { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error("[football] metric-rankings failed:", (err as Error).message);
    return NextResponse.json({ error: "classement indisponible" }, { status: 503 });
  }
}