import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { fetchMlbSlate, fetchMlbLiveState } from "@/lib/baseball/data/mlb-statsapi";
import { MLB_ID_TO_CODE } from "@/lib/baseball/registry";

/**
 * Route live BASEBALL — le game feed MLB, seul endroit où l'état de jeu
 * combinatoire existe (manche × moitié × outs × bases × compte).
 *
 * Pourquoi une route dédiée alors que `/api/baseball/schedule` existe déjà :
 * le schedule hydrate `probablePitcher` mais PAS `liveData`. Or
 * `RUN_EXPECTANCY_MATRIX` est indexée par (bases × outs) : sans cet état,
 * le moteur baseball n'a AUCUN marché calculable et il serait tempting
 * d'afficher les valeurs par défaut — ce qui est un mensonge arithmétique
 * (« bases vides, 0 out » alors que le match est au 7e avec les bases pleines).
 *
 * Cache 10 s : la fenêtre d'un match MLB est large (3 h), l'état ne change
 * que sur un play, et le widget poll toutes les 8 s.
 */
const CACHE_TTL = 10_000;

type LiveGame = {
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeRuns: number | null;
  awayRuns: number | null;
  inning: number;
  half: "top" | "bottom";
  outs: number;
  /** Masque d'occupation des bases : 1 = 1re, 2 = 2e, 4 = 3e. */
  bases: number;
  balls: number;
  strikes: number;
};

type CachedPayload = { liveGames: LiveGame[]; degraded: boolean; checkedAt: string };
const cache = createTtlCache<CachedPayload>("__baseballLiveCache");

export async function GET() {
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json({
      liveGames: cached.data.liveGames,
      source: "mlb-statsapi",
      degraded: cached.data.degraded,
      checkedAt: cached.data.checkedAt,
    });
  }

  try {
    const now = new Date();
    // Le baseball américain : on regarde les matchs du jour ET du lendemain
    // (les nocturnes US débordent sur la date Paris).
    const dates = [
      now.toISOString().slice(0, 10),
      new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10),
    ];

    const seen = new Set<number>();
    const liveGames: LiveGame[] = [];
    let degraded = false;

    for (const date of dates) {
      const slate = await fetchMlbSlate(date);
      if (slate.degraded) degraded = true;
      for (const g of slate.games) {
        if (g.status !== "live" || seen.has(g.gamePk)) continue;
        const state = await fetchMlbLiveState(g.gamePk);
        // Sans état de jeu, le match n'est PAS publié : il est compté dans
        // `degraded`, jamais servi avec des valeurs par défaut.
        if (!state) {
          degraded = true;
          continue;
        }
        seen.add(g.gamePk);
        liveGames.push({
          gamePk: g.gamePk,
          // Le game feed est appelé par gamePk (donc 1 requête par match) :
          // on garde le code d'équipe du schedule, pas un aller-retour de plus.
          homeTeam: MLB_ID_TO_CODE.get(g.homeTeamMlbId) ?? "",
          awayTeam: MLB_ID_TO_CODE.get(g.awayTeamMlbId) ?? "",
          homeRuns: g.homeRuns,
          awayRuns: g.awayRuns,
          inning: state.inning,
          half: state.half,
          outs: state.outs,
          bases: state.bases,
          balls: state.balls,
          strikes: state.strikes,
        });
      }
    }

    if (liveGames.length > 0) {
      cache.set({ liveGames, degraded, checkedAt: new Date().toISOString() });
    }

    return NextResponse.json({
      liveGames,
      source: "mlb-statsapi",
      degraded,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "baseball live");
  }
}