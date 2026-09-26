import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { getHandballNews } from "@/lib/handball-news";

/**
 * GET /api/handball/news — actus handball agrégées (4 sources :
 * HandNews, Handball Planet, L'Équipe, Eurosport) en français.
 * Cache mémoire 30 min côté service ; une source HS est signalée
 * `sources[].ok=false` sans faire échouer la réponse.
 */
export async function GET() {
  try {
    const payload = await getHandballNews();
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/news");
  }
}
