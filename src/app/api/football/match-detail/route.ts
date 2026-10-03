import { NextResponse } from "next/server";
import { getFootballMatches } from "@/lib/football-shared-fetcher";
import type { MetricRankings } from "@/lib/football-data";

/**
 * GET /api/football/match-detail?match=<matchId>&league=<leagueId>
 *
 * Les deux champs lourds de la prédiction, servis **à la demande** quand
 * l'utilisateur ouvre le « Micro-Analysis Radar » d'un match.
 *
 * Pourquoi ils ne sont plus dans `/api/football/matches` (mesuré 2026-10-03) :
 * la liste de 400 matchs weighait **19,46 Mo**, dont 18,29 Mo (94 %) de
 * `metricRankings`. Après retrait de ce champ il restait **1,16 Mo**, dont
 * **644 Ko (56 %) de `metricStats`**. Or les deux ne s'affichent qu'au dépliage
 * du Radar (`radarOpen` vaut `false` au montage) : on les expédiait pour rien à
 * chaque ouverture d'onglet.
 *
 * `metricRankings` est cherché par **ligue** et non par match : la table est
 * identique pour tous les matchs d'une ligue (48 valeurs distinctes pour 295
 * matchs, mesuré), donc le premier match de la ligue qui la porte suffit.
 *
 * 200 `{ metricStats, metricRankings }` · 400 sans `match` · 404 match inconnu.
 */
type RawMatch = {
  id?: string;
  league?: { id?: string };
  prediction?: { metricStats?: unknown; metricRankings?: MetricRankings };
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const matchId = params.get("match");
  const leagueId = params.get("league") ?? undefined;
  if (!matchId) {
    return NextResponse.json({ error: "match requis" }, { status: 400 });
  }

  try {
    const { entry } = await getFootballMatches();
    const matches = entry.data.matches as RawMatch[];

    const self = matches.find((m) => m?.id === matchId);
    if (!self) {
      return NextResponse.json({ error: "match introuvable" }, { status: 404 });
    }

    const rankingsSource =
      matches.find((m) => m?.league?.id === leagueId && m.prediction?.metricRankings) ??
      matches.find((m) => m.prediction?.metricRankings);

    return NextResponse.json(
      {
        metricStats: self.prediction?.metricStats ?? null,
        metricRankings: rankingsSource?.prediction?.metricRankings ?? null,
      },
      { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error("[football] match-detail failed:", (err as Error).message);
    return NextResponse.json({ error: "détail indisponible" }, { status: 503 });
  }
}