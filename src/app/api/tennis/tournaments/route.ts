import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { KNOWN_TOURNAMENTS } from "@/lib/tennis-tournaments-index";
import { fetchTournaments as fetchBsdTournaments } from "@/lib/bsd-tennis-service";
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
 * Enrichissement BSD en second : la liste hardcodée (62 tournois principaux)
 * ne couvre pas la WTA ni les tournois mineurs/challengers — on complète avec
 * les tournois BSD (dédoublonnage par slug, seuls les actifs sont gardés).
 */
async function enrichWithBsd(
  known: TournamentResult[]
): Promise<{ tournaments: TournamentResult[]; used: boolean }> {
  try {
    const res = await fetchBsdTournaments({ limit: 200, include_inactive: false });
    const results = res.results ?? [];
    const seen = new Set(known.map((t) => t.slug));
    let used = false;
    const extra: TournamentResult[] = [];
    for (const t of results) {
      const slug = slugify(t.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      extra.push({
        id: slug,
        name: t.name,
        slug,
        surface: surfaceLabel(t.surface),
        country: t.country ?? undefined,
        category: t.category,
        city: t.location || undefined,
        startDate: t.start_date || undefined,
        endDate: t.end_date || undefined,
      });
      used = true;
    }
    return { tournaments: [...known, ...extra], used };
  } catch {
    // BSD KO → on garde la liste hardcodée, pas de blocage.
    return { tournaments: known, used: false };
  }
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
    // est déjà restreinte aux principaux). Complété par BSD quand dispo.
    // TODO Phase 8+: filtrer par date quand on aura les dates réelles par tournoi.
    const enriched = await enrichWithBsd(KNOWN_TOURNAMENTS);

    const payload: CachedPayload = { tournaments: enriched.tournaments, date: cacheKey };
    cache.set(payload);

    return NextResponse.json<TournamentsResponse>({
      tournaments: enriched.tournaments,
      source: enriched.used ? "bsd" : "hardcoded",
      date,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/tournaments");
  }
}
