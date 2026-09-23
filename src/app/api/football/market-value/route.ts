import { NextResponse } from "next/server";
import { clubMarketValueM } from "@/lib/prediction/football/market-value";

/**
 * GET /api/football/market-value?team=Arsenal
 * Valeur d'effectif Transfermarkt (M€) d'un club — popup fiche équipe.
 * null si club absent du JSON (hors top5 / non scrapé).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team") ?? "";
  if (!team) return NextResponse.json({ team: null, valueM: null });
  return NextResponse.json({ team, valueM: clubMarketValueM(team) });
}
