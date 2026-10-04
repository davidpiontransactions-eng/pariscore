import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import {
  getLeagueBacktest,
  listBacktestLeagues,
  type LeagueBacktestPayload,
} from "@/lib/handball-backtest-history";
import { historyMeta } from "@/lib/handball-history-db";

// 30 min : le moteur walk-forward est recalculé à chaque requête (280 matchs × 2
// paris), inutile de le refaire à chaque rendu. La clé inclut le last_run de la
// table ET les deux paramètres qui changent le résultat → un cron qui passe
// invalide immédiatement, sans attendre le TTL.
const CACHE_TTL = 30 * 60_000;

export type BacktestDbPayload = LeagueBacktestPayload & {
  /** Ligues disponibles, pour le sélecteur. */
  leagues: ReturnType<typeof listBacktestLeagues>;
};

const cache = createTtlCache<{ cacheKey: string; payload: BacktestDbPayload }>(
  "__handballBacktestDbCache",
);

/**
 * GET /api/handball/backtest-db?league=starligue
 *
 * Backtest Pariscore d'une ligue, alimenté par `handball_match_history` (2
 * saisons réelles + cotes 1X2 BetExplorer) et non par un fixture JSON.
 *
 * `league` absent → retourne seulement la liste des ligues, pour que le
 * sélecteur ait de quoi s'afficher sans avoir à deviner un id valide.
 * `all=1` → désactive le filtre « cotes réelles uniquement » (le ROI 1N2 passe
 * alors sur cotes simulées 1xbet, et la note de méthode le dit).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const league = (url.searchParams.get("league") ?? "").trim();
    const all = url.searchParams.get("all") === "1";
    const leagues = listBacktestLeagues();

    if (league === "") {
      return NextResponse.json({
        league: null,
        result: null,
        reason: null,
        leagues,
        updatedAt: new Date().toISOString(),
      } satisfies BacktestDbPayload);
    }

    const meta = historyMeta();
    // `lastRun` dans la clé : le cron quotidien écrit chaque nuit, le cache doit
    // sauter sans attendre 30 min.
    const cacheKey = `${league}|${all ? "all" : "odds"}|${meta?.lastRun ?? "none"}`;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL) && cached.data.cacheKey === cacheKey) {
      return NextResponse.json(cached.data.payload);
    }

    const payload: BacktestDbPayload = {
      ...getLeagueBacktest(league, { withOddsOnly: !all }),
      leagues,
    };
    cache.set({ cacheKey, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/backtest-db");
  }
}