import type { NextRequest } from "next/server";
import { GET as oddsGET } from "../../../basketball/odds/route";

/**
 * Alias nginx-safe de GET /api/basketball/odds (même handler, même contrat,
 * rate-limit The Odds API inclus). Le préfixe /api/v1/ est proxifié vers
 * pariscore-next par le bloc catch-all nginx du VPS — utilisé car le bloc
 * nginx /api/basketball/ manque (404 FastAPI sur le domaine public). Pattern
 * déjà employé par /api/v1/basketball/h2h et handball/ai-analysis (import GET
 * depuis route sœur, validé en prod).
 */
export async function GET(req: NextRequest) {
  return oddsGET(req);
}
