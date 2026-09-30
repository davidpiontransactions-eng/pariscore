import type { NextRequest } from "next/server";
import { GET as euroleagueGET } from "../../../euroleague/matches/route";

/**
 * Alias nginx-safe de GET /api/euroleague/matches (même handler, même contrat).
 * Le préfixe /api/v1/ est proxifié vers pariscore-next par le bloc catch-all
 * nginx du VPS — utilisé car le bloc nginx /api/euroleague/ manque (404
 * FastAPI sur le domaine public, constaté en QA entry 108 : le hook
 * useEuroLeagueMatches alimentant les vues Matchs/Live basket bouclait en 404).
 * Pattern déjà employé par /api/v1/basketball/* et handball/ai-analysis
 * (import GET depuis route sœur, validé en prod).
 */
export async function GET(req: NextRequest) {
  return euroleagueGET(req);
}
