import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { isFlashscoreFresh } from "@/lib/handball-flashscore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 5 * 60_000;

type CachedPayload = {
  matches: unknown[];
  degraded: boolean;
  source: string;
  scrapedAt?: string;
  stale?: boolean;
};
const cache = createTtlCache<CachedPayload>("__handballMatchesCache");

type FlashscoreMatch = {
  id?: string;
  time?: string;
  home: string;
  away: string;
  score?: string | null;
  isLive?: boolean;
  isFinished?: boolean;
  league?: string;
  country?: string;
  odds?: number[];
  homeHalf?: number;
  awayHalf?: number;
  minute?: number;
};

// Lire les données Flashscore depuis le fichier JSON
function loadFlashscoreHandball(): Array<{
  id: string;
  league: { name: string; country: string };
  home: { name: string };
  away: { name: string };
  kickoff: string;
  status: string;
  score?: { home: number; away: number; homeHalf?: number; awayHalf?: number };
  minute?: number;
  odds?: { home?: number; draw?: number; away?: number };
}> {
  try {
    const filePath = join(process.cwd(), "data", "flashscore_handball.json");
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as FlashscoreMatch[];
    return matches
      .filter((m) => m.home && m.away)
      .map((m): { id: string; league: { name: string; country: string }; home: { name: string }; away: { name: string }; kickoff: string; status: "live" | "finished" | "not_started"; score?: { home: number; away: number; homeHalf?: number; awayHalf?: number }; minute?: number; odds?: { home?: number; draw?: number; away?: number } } => {
        // Parser le score "34 - 36" → { home: 34, away: 36 }
        let scoreObj: { home: number; away: number; homeHalf?: number; awayHalf?: number } | undefined;
        if (m.score && m.score !== "- - -") {
          const parts = m.score.split(/\s*-\s*/);
          if (parts.length >= 2) {
            const home = parseInt(parts[0]) || 0;
            const away = parseInt(parts[1]) || 0;
            if (home > 0 || away > 0) {
              scoreObj = { home, away };
              if (m.homeHalf != null) scoreObj.homeHalf = m.homeHalf;
              if (m.awayHalf != null) scoreObj.awayHalf = m.awayHalf;
            }
          }
        }

        // Statut
        let status: "live" | "finished" | "not_started" = "not_started";
        if (m.isLive) status = "live";
        else if (m.isFinished) status = "finished";

        // Kickoff — le scraper fournit déjà un ISO string dans `time`
        let kickoff = m.time || new Date().toISOString();

        // Cotes 1X2
        let odds: { home?: number; draw?: number; away?: number } | undefined;
        if (m.odds && m.odds.length >= 2) {
          odds = { home: m.odds[0], away: m.odds[m.odds.length >= 3 ? 2 : 1] };
          if (m.odds.length >= 3) odds.draw = m.odds[1];
        }

        return {
          id: m.id || `fs-${m.home}-${m.away}`.replace(/\s+/g, "-").toLowerCase(),
          league: { name: m.league || "Handball", country: m.country || "" },
          home: { name: m.home },
          away: { name: m.away },
          kickoff,
          status,
          score: scoreObj,
          minute: m.minute,
          odds,
        };
      });
  } catch {
    return [];
  }
}

/** scraped_at racine du snapshot (fraîcheur honnête — fix audit 2026-09-23). */
function loadFlashscoreScrapedAt(): string | null {
  try {
    const filePath = join(process.cwd(), "data", "flashscore_handball.json");
    if (!existsSync(filePath)) return null;
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
  const flashscoreMatches = loadFlashscoreHandball();
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
    const merged = [...live, ...fixtures.filter((m) => !liveIds.has(m.id))];
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
