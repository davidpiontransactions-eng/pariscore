import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchLiveNhlMatches, type NhlLiveMatch } from "@/lib/hockey/data/espn-nhl";

/**
 * Route live HOCKEY — scoreboard ESPN NHL, appelé à la requête.
 *
 * Pourquoi cette route existe en plus de `/api/hockey/matches` :
 *   - `/api/hockey/matches` sert un CALENDRIER (scoreboards + fixtures KHL/NHL)
 *     mis en cache 5 min, sans période ni horloge ;
 *   - le moteur `live-hockey.ts` a besoin de `period` + `periodSecondsLeft`
 *     pour projeter les buts restants sur le TEMPS RÉGLEMENTAIRE, et du score
 *     pour tout marché de marge ;
 *   - `nhl_schedule.json` porte `homeGoals: null` tant que le match n'est pas
 *     terminé (`scrape-nhl-schedule.mjs:275-276`) — structurellement incapable.
 *
 * TTL 10 s : l'état ne change que sur un tir, et le widget poll toutes les 8 s.
 * Cache écrit UNIQUEMENT quand au moins un match live est servi — un cache
 * vide se re-remplit tout seul au tick suivant, alors qu'un cache « aucun
 * match » pendant 10 s retarderait l'affichage d'un but marqué à la 8e seconde.
 */
const CACHE_TTL = 10_000;

type CachedPayload = { matches: NhlLiveMatch[]; degraded: boolean };
const cache = createTtlCache<CachedPayload>("__hockeyLiveCache");

export async function GET() {
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: "espn-nhl",
      degraded: cached.data.degraded,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { matches, degraded } = await fetchLiveNhlMatches();
    if (matches.length > 0) {
      cache.set({ matches, degraded });
    }
    return NextResponse.json({
      matches,
      source: "espn-nhl",
      degraded,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // On NE renvoie pas 503 : le widget garde alors son dernier bundle connu et
    // signale « flux coupé » au lieu de remplacer le panneau par une erreur.
    console.error("[hockey-live] ESPN failed:", (err as Error).message);
    const stale = cache.get();
    return NextResponse.json({
      matches: stale ?? [],
      source: "espn-nhl",
      degraded: true,
      updatedAt: new Date().toISOString(),
    });
  }
}