import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import {
  isFlashscoreFresh,
  resolveHandballDataFile,
  toHandballMatch,
  type FlashscoreMatch,
} from "@/lib/handball-flashscore";
import { readFileSync } from "fs";
import type { HandballMatch } from "@/lib/handball-data";
import { applyPapiOdds, loadOddsPapiSnapshot } from "@/lib/odds-handball-papi";

const CACHE_TTL = 5 * 60_000;

type CachedPayload = {
  matches: unknown[];
  degraded: boolean;
  source: string;
  scrapedAt?: string;
  stale?: boolean;
};
const cache = createTtlCache<CachedPayload>("__handballMatchesCache");

// Lecture du snapshot Flashscore — mapping partagé toHandballMatch (ids
// d'équipe = hash du nom) : le mapper inline local fournissait home/away
// SANS id → impossible de construire un form-store côté client (forme L5,
// moyennes de buts, paris ajustés de la popup détail).
function loadFlashscoreHandball(): HandballMatch[] {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as FlashscoreMatch[];
    return matches
      .filter((m) => m.home && m.away)
      .map((m, i) => toHandballMatch(m, i));
  } catch {
    return [];
  }
}

/** scraped_at racine du snapshot (fraîcheur honnête — fix audit 2026-09-23). */
function loadFlashscoreScrapedAt(): string | null {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return null;
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return typeof data.scraped_at === "string" ? data.scraped_at : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
      scrapedAt: cached.data.scrapedAt ?? null,
      stale: cached.data.stale ?? false,
      updatedAt: cached.data.scrapedAt ?? new Date(cached.at).toISOString(),
    });
  }

  // Flashscore = source principale (API-Sports handball = abonnement séparé).
  // Fix audit I13 : gate scraped_at > 20h → stale déclaré, fallback tenté,
  // puis stale servi honnête (jamais d'onglet vide silencieux).
  // Fix G6-2 : snapshot Papi (data/odds_handball_papi.json, cron 04:40 UTC)
  // lu en complément — rempli les odds/openingOdds des matchs Flashscore
  // vides. Loader readonly, null si absent → identity, input non muté.
  const flashscoreMatches = applyPapiOdds(loadFlashscoreHandball(), loadOddsPapiSnapshot());
  const scrapedAt = loadFlashscoreScrapedAt();
  const stale = flashscoreMatches.length > 0 && !isFlashscoreFresh(scrapedAt);

  if (flashscoreMatches.length > 0 && !stale) {
    const payload: CachedPayload = {
      matches: flashscoreMatches,
      degraded: false,
      source: "flashscore",
      scrapedAt: scrapedAt ?? undefined,
      stale: false,
    };
    cache.set(payload);
    return NextResponse.json({
      matches: payload.matches,
      source: payload.source,
      degraded: false,
      scrapedAt: payload.scrapedAt ?? null,
      stale: false,
      updatedAt: payload.scrapedAt ?? new Date(now).toISOString(),
    });
  }

  // Snapshot stale ou vide → fallback API-Sports
  try {
    const { fetchHandballFixtures, fetchHandballLive } = await import("@/lib/handball-api");
    const [fixtures, live] = await Promise.all([
      fetchHandballFixtures().catch(() => [] as never[]),
      fetchHandballLive().catch(() => [] as never[]),
    ]);
    const liveIds = new Set(live.map((m) => m.id));
    const merged = applyPapiOdds(
      [...live, ...fixtures.filter((m) => !liveIds.has(m.id))],
      loadOddsPapiSnapshot()
    );
    if (merged.length > 0) {
      const payload: CachedPayload = { matches: merged, degraded: false, source: "api-sports" };
      cache.set(payload);
      return NextResponse.json({
        matches: merged,
        source: "api-sports",
        degraded: false,
        scrapedAt: null,
        stale: false,
        updatedAt: new Date(now).toISOString(),
      });
    }
  } catch {
    // API-Sports indisponible
  }

  // Stale servi honnête (cache 5 min → le fallback est retenté régulièrement)
  if (flashscoreMatches.length > 0) {
    const payload: CachedPayload = {
      matches: flashscoreMatches,
      degraded: false,
      source: "flashscore",
      scrapedAt: scrapedAt ?? undefined,
      stale: true,
    };
    cache.set(payload);
    return NextResponse.json({
      matches: payload.matches,
      source: payload.source,
      degraded: false,
      scrapedAt: payload.scrapedAt ?? null,
      stale: true,
      updatedAt: payload.scrapedAt ?? new Date(now).toISOString(),
    });
  }

  // Aucune source disponible
  return NextResponse.json({
    matches: [],
    source: "none",
    degraded: true,
    scrapedAt: null,
    stale: true,
    updatedAt: new Date(now).toISOString(),
  });
}
