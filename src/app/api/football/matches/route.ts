import { NextResponse } from "next/server";
import { getFootballMatches } from "@/lib/football-shared-fetcher";

/**
 * GET /api/football/matches
 *
 * ⚠️ `prediction.metricRankings` ET `prediction.metricStats` sont RETIRÉS de la
 * réponse — mesuré le 2026-10-03 :
 *
 * - avant : **19,46 Mo pour 408 matchs**, dont 18,29 Mo (94 %) de
 *   `metricRankings`. Le champ contient le classement complet de la ligue pour
 *   chaque métrique, **identique pour tous les matchs d'une ligue** (48 valeurs
 *   distinctes pour 295 matchs, donc 2 à 16 copies). 1,7 Mo par match sur les
 *   « Club Friendlies ». Le match complet ne fait que 2 Ko sans lui.
 * - après retrait : **1,16 Mo**, dont 644 Ko (56 %) de `metricStats`.
 *
 * Or ces deux champs ne s'affichent qu'au dépliage du « Micro-Analysis Radar »
 * d'un match (`radarOpen` vaut `false` au montage) : on les expédiait pour rien
 * à chaque ouverture d'onglet.
 *
 * Conséquence avant correctif : le navigateur téléchargeait 19,5 Mo, `res.json()`
 * ramait puis échouait, et l'onglet restait **muet** — le `catch` vide la liste,
 * sans la moindre erreur console.
 *
 * Chargement à la demande : `GET /api/football/match-detail?match=<id>&league=<id>`.
 * Même traitement déjà appliqué à `/api/football/calendar`.
 *
 * ⚠️ Deux consommateurs : `useFootballMatches` (onglet) et `use-sports-tree`
 * (rangée de l'accueil) lisent cette route.
 */
export async function GET() {
  try {
    const { entry, now } = await getFootballMatches();

    const matches = (entry.data.matches as Record<string, unknown>[]).map((m) => {
      const prediction = m?.prediction as Record<string, unknown> | undefined;
      if (!prediction?.metricRankings && !prediction?.metricStats) return m;
      const { metricRankings: _dropRanks, metricStats: _dropStats, ...rest } = prediction;
      return { ...m, prediction: rest };
    });

    return NextResponse.json({
      matches,
      source: entry.data.source,
      degraded: entry.data.degraded,
      updatedAt: new Date(entry.data.degraded ? now : entry.at).toISOString(),
    });
  } catch (err) {
    console.error("[football] fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "football data unavailable" }, { status: 503 });
  }
}