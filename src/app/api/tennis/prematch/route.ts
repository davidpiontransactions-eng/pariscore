import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { MATCHES, type TennisMatch } from "@/lib/tennis-data";

const CACHE_TTL_MS = 5 * 60_000;
// Stale-while-error : si les sources externes sont KO, on sert le cache
// périmé jusqu'à 1h au lieu de renvoyer un 503 bloquant (bug B2).
const STALE_GRACE_MS = 60 * 60_000;
const PAST_GRACE_MS = 30 * 60_000;

// The cache stores the API payload shape directly. `createTtlCache` already
// wraps the value in `{ data, at }`, so we must NOT add our own `{ data, at }`
// wrapper here (that caused bug A9: `cached.data` was the inner object instead
// of the matches array, crashing client-side with "matches is not iterable").
type CachedPayload = { matches: unknown[]; source: string };
const cache = createTtlCache<CachedPayload>("__tennisPrematchCache");

function filterStale(matches: { scheduledAt: string }[]): typeof matches {
  const cutoff = Date.now() - PAST_GRACE_MS;
  return matches.filter((m) => {
    const ms = Date.parse(m.scheduledAt);
    return !Number.isFinite(ms) || ms >= cutoff;
  });
}

/**
 * Re-date le mock local (tennis-data.ts) sur la journée courante pour le
 * mode dégradé : les mocks sont datés (ex: Wimbledon 2026-07-08) et
 * disparaîtraient des filtres « Aujourd'hui »/fenêtre horaire sinon.
 */
function mockForToday(): TennisMatch[] {
  const base = Date.now();
  return MATCHES.map((m, i) => ({
    ...m,
    id: `mock-${m.id}`,
    scheduledAt: new Date(base + (i + 1) * 2 * 3600_000).toISOString(),
  }));
}

/**
 * 1 retry sur erreurs transitoires (429 / 5xx) avant de basculer sur la
 * source suivante — évite un fallback prématuré sur un pic de rate-limit.
 * Les erreurs BSD sont des AppError (`statusCode`) ; les Error nus du
 * fallback Odds API n'exposent rien → non retentées (comportement voulu).
 */
async function fetchWithTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status =
      (err as { statusCode?: number })?.statusCode ??
      (err as { status?: number })?.status;
    const code = (err as { code?: string })?.code;
    const transient =
      code === "BSD_RATE_LIMIT" || (typeof status === "number" && status >= 500 && status < 600);
    if (!transient) throw err;
    await new Promise((r) => setTimeout(r, 300));
    return fn();
  }
}

export async function GET() {
  try {
    const now = Date.now();

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS)) {
      return NextResponse.json({
        matches: cached.data.matches,
        source: cached.data.source,
        updatedAt: new Date(cached.at).toISOString(),
      });
    }

    const bsdKey = process.env.BSD_API_KEY;
    const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
    const oddsKey = process.env.ODDS_API_KEY;

    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
        const matches = filterStale(await fetchWithTransientRetry(fetchBSDMatches));
        cache.set({ matches, source: "bsd" });
        return NextResponse.json({
          matches,
          source: "bsd",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[prematch] BSD failed:", (err as Error).message);
      }
    }

    if (oddsKey) {
      try {
        const { fetchRealMatches } = await import("@/lib/real-matches");
        const matches = filterStale(await fetchWithTransientRetry(() => fetchRealMatches(oddsKey)));
        cache.set({ matches, source: "odds-api" });
        return NextResponse.json({
          matches,
          source: "odds-api",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[prematch] Odds API failed:", (err as Error).message);
      }
    }

    // Stale-while-error : cache périmé dispo → servi tel quel (source distincte
    // pour que l'UI affiche le bandeau « données en cache »).
    if (cached && Date.now() - cached.at < STALE_GRACE_MS) {
      console.warn(
        `[prematch] Sources KO, serving stale cache (age=${Math.round((Date.now() - cached.at) / 1000)}s)`,
      );
      return NextResponse.json({
        matches: cached.data.matches,
        source: "cache-stale",
        updatedAt: new Date(cached.at).toISOString(),
      });
    }

    // Dernier recours : mock local re-daté — l'onglet reste exploitable
    // (source "mock", bandeau mode dégradé côté UI).
    console.warn("[prematch] Sources KO + no stale cache, serving local mock");
    return NextResponse.json({
      matches: mockForToday(),
      source: "mock",
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/prematch");
  }
}