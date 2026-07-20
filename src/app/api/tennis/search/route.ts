import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { searchPlayers } from "@/lib/tennis-search-index";
import { searchTournaments } from "@/lib/tennis-tournaments-index";
import {
  SEARCH_TYPES,
  type SearchResponse,
  type SearchType,
} from "@/lib/tennis-search-types";

/**
 * GET /api/tennis/search?q=<query>&type=players|tournaments|all
 *
 * Autocomplete unifié joueurs + tournois. Cache 60s.
 *
 * La DB legacy `pariscore.db` est vide (voir docs/P8-CONTEXT-DB-LEGACY.md),
 * donc la source est le fallback hardcodé `TOP_PLAYERS` (93 ATP) +
 * `KNOWN_TOURNAMENTS` (62 tournois). C'est l'Option A du brief P8.
 *
 * - `q` doit faire ≥ 2 caractères (sinon retourne `{ total: 0 }`)
 * - `type` valide les valeurs du enum SEARCH_TYPES (fallback "all")
 * - Source marquée dans la réponse pour debug/transparence
 */
const CACHE_TTL_MS = 60_000; // 1 min

type CachedSearch = SearchResponse & { __cacheKey: string };
const cache = createTtlCache<CachedSearch>("__tennisSearchCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const typeParam = searchParams.get("type") ?? "all";

    // Valider type (fallback "all" si invalide — pas d'erreur 400 pour UX)
    const type: SearchType = (
      SEARCH_TYPES as readonly string[]
    ).includes(typeParam)
      ? (typeParam as SearchType)
      : "all";

    // q trop court → réponse vide (pas erreur 400 — l'UI n'a juste rien à afficher)
    if (q.length < 2) {
      return NextResponse.json<SearchResponse>({
        players: [],
        tournaments: [],
        total: 0,
        query: q,
        type,
        source: "empty",
        updatedAt: new Date().toISOString(),
      });
    }

    // Cache key : q lowercased + type
    const cacheKey = `${q.toLowerCase()}:${type}`;
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data?.__cacheKey === cacheKey) {
      // Strip la clé interne avant de retourner
      const { __cacheKey: _omit, ...rest } = cached.data;
      void _omit;
      return NextResponse.json<SearchResponse>(rest);
    }

    const players = type === "tournaments" ? [] : searchPlayers(q, 10);
    const tournaments = type === "players" ? [] : searchTournaments(q, 10);

    const response: SearchResponse & { __cacheKey: string } = {
      players,
      tournaments,
      total: players.length + tournaments.length,
      query: q,
      type,
      source: "hardcoded-top100",
      updatedAt: new Date().toISOString(),
      __cacheKey: cacheKey,
    };

    cache.set(response);

    // Strip la clé interne avant de retourner au client
    const { __cacheKey: _omit, ...clientResponse } = response;
    void _omit;
    return NextResponse.json<SearchResponse>(clientResponse);
  } catch (err) {
    return apiErrorHandler(err, "tennis/search");
  }
}
