import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { searchPlayers } from "@/lib/tennis-search-index";
import { searchTournaments } from "@/lib/tennis-tournaments-index";
import { fetchPlayers, fetchTournaments } from "@/lib/bsd-tennis-service";
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

/** Slug lisible depuis un nom BSD (même convention que l'index local). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Surface BSD → surface affichable (convention TournamentResult). */
function surfaceLabel(s: string): string | undefined {
  switch (s) {
    case "hard":
      return "Dur";
    case "clay":
      return "Terre";
    case "grass":
      return "Gazon";
    case "carpet":
      return "Moquette";
    default:
      return undefined;
  }
}

/**
 * Enrichissement BSD en second : l'index local (93 ATP hardcodés, 62 tournois)
 * ne couvre pas la WTA ni les tournois mineurs — on complète avec les
 * résultats BSD (recherche joueurs native + filtrage tournois côté serveur,
 * l'endpoint tournois BSD n'a pas de param search).
 */
async function enrichWithBsd(
  q: string,
  type: SearchType,
  players: Awaited<ReturnType<typeof searchPlayers>>,
  tournaments: Awaited<ReturnType<typeof searchTournaments>>
): Promise<{ players: typeof players; tournaments: typeof tournaments; used: boolean }> {
  try {
    const ql = q.toLowerCase();
    let used = false;

    if (type !== "tournaments") {
      const res = await fetchPlayers({ search: q, limit: 10 });
      const results = res.results ?? [];
      for (const p of results) {
        const slug = slugify(p.name);
        if (players.some((x) => x.slug === slug)) continue;
        players = [
          ...players,
          {
            id: slug,
            name: p.name,
            slug,
            rank: p.current_ranking?.position,
            country: p.country ?? undefined,
            circuit: p.current_ranking?.type ?? (p.gender === "F" ? "WTA" : "ATP"),
          },
        ];
        used = true;
      }
    }

    if (type !== "players") {
      const res = await fetchTournaments({ limit: 200 });
      const results = res.results ?? [];
      for (const t of results) {
        if (!t.name.toLowerCase().includes(ql)) continue;
        const slug = slugify(t.name);
        if (tournaments.some((x) => x.slug === slug)) continue;
        tournaments = [
          ...tournaments,
          {
            id: slug,
            name: t.name,
            slug,
            surface: surfaceLabel(t.surface),
            country: t.country ?? undefined,
            category: t.category,
            city: t.location || undefined,
            startDate: t.start_date || undefined,
            endDate: t.end_date || undefined,
          },
        ];
        used = true;
      }
    }

    return { players, tournaments, used };
  } catch {
    // BSD KO → on garde les résultats locaux, pas de blocage.
    return { players, tournaments, used: false };
  }
}

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

    // BSD en second — complète l'index local (WTA, tournois mineurs).
    const enriched = await enrichWithBsd(q, type, players, tournaments);

    const response: SearchResponse & { __cacheKey: string } = {
      players: enriched.players,
      tournaments: enriched.tournaments,
      total: enriched.players.length + enriched.tournaments.length,
      query: q,
      type,
      source: enriched.used ? "bsd" : "hardcoded-top100",
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
