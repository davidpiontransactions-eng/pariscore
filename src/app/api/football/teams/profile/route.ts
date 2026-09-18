import { NextResponse } from "next/server";
import { buildTeamProfile, type MarketInput, type TeamProfile } from "@/lib/team-profile";
import type { FdScope } from "@/lib/football-fd";

/**
 * GET /api/football/teams/profile?league=epl&team=Arsenal&venue=home
 *   [&fairH&fairD&fairA (probas fair 0-100) &oddsH&oddsD&oddsA (cotes décimales)]
 *
 * Fiche saison d'une équipe : classement + PPG du contexte (domicile si
 * venue=home, extérieur si away), PowerScores Attaque/Défense avec rangs
 * intra-ligue, forces/faiblesses, Elo interne, infirmerie RotoWire.
 * Si marché fourni : value modèle-vs-cotes sur le camp de l'équipe.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league");
  const team = url.searchParams.get("team");
  if (!league || !team) {
    return NextResponse.json({ error: "league et team requis" }, { status: 400 });
  }
  const venueParam = url.searchParams.get("venue") ?? "home";
  const venue: FdScope = ["overall", "home", "away"].includes(venueParam)
    ? (venueParam as FdScope)
    : "home";

  // Marché optionnel (fair 0-100 + cotes) pour la value.
  const num = (k: string): number | null => {
    const v = url.searchParams.get(k);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const fairH = num("fairH"), fairD = num("fairD"), fairA = num("fairA");
  const oddsH = num("oddsH"), oddsD = num("oddsD"), oddsA = num("oddsA");
  const market: MarketInput | undefined =
    fairH != null && fairD != null && fairA != null && oddsH != null && oddsD != null && oddsA != null
      ? {
          fair: { home: fairH / 100, draw: fairD / 100, away: fairA / 100 },
          odds: { home: oddsH, draw: oddsD, away: oddsA },
        }
      : undefined;

  let profile: TeamProfile | null = null;
  try {
    profile = buildTeamProfile(league, team, venue, market);
  } catch {
    return NextResponse.json({ error: "calcul indisponible" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "équipe ou ligue introuvable" }, { status: 404 });
  }
  return NextResponse.json({ profile, meta: { computedAt: new Date().toISOString() } });
}
