import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { KNOWN_TOURNAMENTS } from "@/lib/tennis-tournaments-index";
import type { TournamentsResponse, TournamentResult } from "@/lib/tennis-search-types";

/**
 * GET /api/tennis/tournaments?date=<YYYY-MM-DD>
 *
 * Liste des tournois ATP/WTA connus (Option A — fallback hardcodé car la DB
 * legacy est vide, voir docs/P8-CONTEXT-DB-LEGACY.md).
 *
 * La `date` est optionnelle (défaut : aujourd'hui). Pour l'instant la liste
 * est statique (62 tournois principaux), mais la signature permet d'ajouter
 * un filtrage par date ultérieurement (ex: tournois actifs cette semaine).
 *
 * Cache 5 min (les tournois changent rarement).
 */
const CACHE_TTL_MS = 5 * 60_000;

type CachedPayload = { tournaments: TournamentResult[]; date: string };
const cache = createTtlCache<CachedPayload>("__tennisTournamentsCache");

/** Valide le format YYYY-MM-DD. */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") ?? "";
    const today = new Date().toISOString().slice(0, 10);
    const date = dateParam && isValidDate(dateParam) ? dateParam : today;

    // Cache : 1 entrée par date
    const cacheKey = date;
    const cached = cache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL_MS) &&
      cached.data?.date === cacheKey
    ) {
      return NextResponse.json<TournamentsResponse>({
        tournaments: cached.data.tournaments,
        source: "hardcoded",
        date: cached.data.date,
        updatedAt: new Date().toISOString(),
      });
    }

    // Pour l'instant on retourne tous les tournois connus (pas de filtrage
    // par date — les tournois ATP tournent toute l'année et la liste hardcodée
    // est déjà restreinte aux principaux).
    // TODO Phase 8+: filtrer par date quand on aura les dates réelles par tournoi.
    const tournaments: TournamentResult[] = KNOWN_TOURNAMENTS;

    const payload: CachedPayload = { tournaments, date: cacheKey };
    cache.set(payload);

    return NextResponse.json<TournamentsResponse>({
      tournaments,
      source: "hardcoded",
      date,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/tournaments");
  }
}
