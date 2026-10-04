import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { historyMeta, loadTeamSeriesByNames } from "@/lib/handball-history-db";

// 15 min : la table est réécrite par le cron quotidien, inutile de re-requêter
// à chaque rendu du TOP 10. La clé inclut la liste d'équipes ET le last_run de
// la table → un cron qui passe invalide immédiatement, sans attendre le TTL.
const CACHE_TTL = 15 * 60_000;
/** Garde-fou : une requête ne demande pas 500 équipes. */
const MAX_TEAMS = 40;

export type TeamSeriesPayload = {
  /** Par nom d'équipe tel que demandé. null = pas d'historique (jamais de zéros). */
  series: Record<string, { gf: number[]; ga: number[]; atHome: boolean[] } | null>;
  meta: { n: number; minDate: string | null; maxDate: string | null; lastRun: string | null } | null;
  updatedAt: string;
};

const cache = createTtlCache<{ cacheKey: string; payload: TeamSeriesPayload }>(
  "__handballTeamSeriesCache",
);

/**
 * GET /api/handball/history-series?teams=Nantes|Limoges|…
 *
 * Séries gf/ga/atHome des derniers matchs de chaque équipe, lues dans
 * `handball_match_history` (table peuplée par le cron quotidien).
 *
 * Sert le tableau TOP 10 : son calcul de seuil exige ≥ 3 matchs terminés par
 * équipe. Avant, il lisait le form-store du SNAPSHOT courant — vide dès que
 * l'ingestion décroche, ce qui rendait le tableau vide (et le rendait encore).
 * La table d'historique, elle, couvre 2 saisons.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const teams = (url.searchParams.get("teams") ?? "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TEAMS);
    const limit = Math.min(
      20,
      Math.max(3, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10),
    );

    const meta = historyMeta();
    const cacheKey = `${teams.join(",")}|${limit}|${meta?.lastRun ?? "none"}`;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL) && cached.data.cacheKey === cacheKey) {
      return NextResponse.json(cached.data.payload);
    }

    const payload: TeamSeriesPayload = {
      series: loadTeamSeriesByNames(teams, limit),
      meta,
      updatedAt: new Date().toISOString(),
    };
    if (teams.length > 0) {
      cache.set({ cacheKey, payload });
    }
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/history-series");
  }
}
