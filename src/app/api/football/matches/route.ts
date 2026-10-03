import { NextResponse } from "next/server";
import { getFootballMatches } from "@/lib/football-shared-fetcher";

/**
 * GET /api/football/matches
 *
 * ⚠️ `prediction.metricRankings` est RETIRÉ de la réponse — mesuré le
 * 2026-10-03 : la route renvoyait **19,5 Mo pour 408 matchs**, dont **18,3 Mo
 * (94 %) de `metricRankings`**.
 *
 * Le champ contient le classement complet de la ligue pour chaque métrique, et
 * il est **le même pour tous les matchs d'une ligue** (48 valeurs distinctes
 * pour 295 matchs concernés, donc 2 à 16 copies de la même table). Sur les
 * « Club Friendlies » il pèse 1,7 Mo *à chaque match*.
 *
 * Le match complet ne fait que 2 Ko sans ce champ : la donnée est fausse, pas
 * le calcul.
 *
 * Conséquence avant correctif : à l'ouverture de l'onglet Football, le
 * navigateur télécharge 19,5 Mo, `res.json()` rame ou échoue, et l'onglet
 *_muet_ (le `catch` vide la liste) — sans aucune erreur visible.
 *
 * Le classement est chargé **à la demande** quand l'utilisateur ouvre l'onglet
 * « Classements » d'un match : `GET /api/football/metric-rankings?league=<id>`.
 * Même traitement déjà appliqué à `/api/football/calendar`.
 */
export async function GET() {
  try {
    const { entry, now } = await getFootballMatches();

    const matches = (entry.data.matches as Record<string, unknown>[]).map((m) => {
      const prediction = m?.prediction as Record<string, unknown> | undefined;
      if (!prediction?.metricRankings) return m;
      const { metricRankings: _drop, ...rest } = prediction;
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