import { NextResponse } from "next/server";
import { getFootballNews } from "@/lib/football-news";

/**
 * GET /api/football/news
 *
 * Agrège les flux RSS publics du football (cf. `src/lib/football-news.ts`).
 * Le cache et l'isolation des pannes sont gérés dans la lib ; cette route se
 * contente d'exposer le résultat.
 *
 * Cache HTTP 5 min : la lib tient 10 min en mémoire, le 5 min évite de servir
 * une réponse périmée après un redéploiement qui vide le processus.
 */
export const revalidate = 300;

export async function GET() {
  const result = await getFootballNews();
  return NextResponse.json(
    result,
    { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}