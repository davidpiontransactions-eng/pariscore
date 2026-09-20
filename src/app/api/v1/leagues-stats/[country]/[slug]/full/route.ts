import { NextRequest, NextResponse } from "next/server";
import { resolveLeagueIds } from "@/lib/league-id-bridge";
import { fbrefPlayerStats, type FbrefStatType } from "@/lib/football-fbref-stats";
import { understatPlayers, type UnderstatPlayer } from "@/lib/football-understat-players";
import { leagueXgRanking } from "@/lib/football-xg";
import { fdStandings } from "@/lib/football-fd";
import { computeStandings } from "@/lib/league-stats-compute";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { getLeague } from "@/lib/leagues-stats/db";

/**
 * API unifiée /api/v1/leagues-stats/[country]/[slug]/full
 *
 * Fusionne les données de 4 sources pour la page championnat :
 *   - OddAlerts : stats league-level (scrape-oddalerts.js)
 *   - BSD : standings + matchs (via computeStandings)
 *   - FBref : player season stats (passing, possession, defense, misc)
 *   - Understat : player xG/xAG/npxG/shots/key_passes
 *
 * Query params:
 *   - season: année BSD (défaut: 2025)
 *   - location: all|home|away (défaut: all)
 *
 * Cache: LRU in-memory, max 50 entries, TTL 30min.
 */

// ── LRU Cache ──

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

const CACHE_TTL = 30 * 60_000; // 30 min
const CACHE_MAX = 50;
const cache = new Map<string, { at: number; data: unknown }>();

function lruGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function lruSet(key: string, data: unknown): void {
  // Evict oldest if at capacity
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { at: Date.now(), data });
}

// ── BSD fetch via module partagé ──
import { bsdFetch } from "@/lib/bsd-football-fetcher";

type FullLeagueResponse = {
  league: {
    slug: string;
    name: string;
    country: string;
    sources: {
      bsd: boolean;
      fbref: boolean;
      understat: boolean;
    };
  };
  standings: unknown[];
  playerStats: Record<string, unknown[]>;
  understatPlayers: UnderstatPlayer[] | null;
  xgRanking: unknown[] | null;
  marketSections: unknown[] | null;
  meta: {
    computedAt: string;
    cacheTtl: number;
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ country: string; slug: string }> },
) {
  const { country, slug: urlSlug } = await params;
  const url = new URL(req.url);
  const season = url.searchParams.get("season") || "2025";
  const location = url.searchParams.get("location") || "all";
  const requestedStats = url.searchParams.get("playerStats");

  // Résolution des identifiants
  const ids = resolveLeagueIds(`${country}/${urlSlug}`);
  if (!ids) {
    return NextResponse.json(
      { error: `Ligue introuvable: ${country}/${urlSlug}` },
      { status: 404 },
    );
  }

  // Cache check (LRU)
  const cacheKey = `full:${ids.slug}:${season}:${location}:${requestedStats ?? "all"}`;
  const cached = lruGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ── 1. Standings BSD ──
  let standings: unknown[] = [];
  if (ids.hasBsd) {
    try {
      const allMatches = await bsdFetch<BSDFootballMatch[]>(
        `/matches/?status=finished&limit=200`,
      );
      const leagueMatches = allMatches.filter(
        (m: any) => m?.league?.id === ids.bsdId,
      );
      if (leagueMatches.length >= 5) {
        const result = computeStandings(leagueMatches, location as any);
        standings = result.standings;
      }
    } catch (e) {
      console.log(`[full] BSD unavailable for ${ids.slug}: ${(e as Error).message}`);
    }
  }

  // Fallback football-data.co.uk si pas de standings BSD
  if (!standings.length) {
    try {
      const fdRows = fdStandings(ids.slug, season, location as any);
      if (fdRows) {
        standings = fdRows;
      }
    } catch {
      // pas de fallback fd non plus
    }
  }

  // ── 2. Player stats FBref ──
  const playerStats: Record<string, unknown[]> = {};
  const fbrefSeason = `${season}-${parseInt(season) + 1}`;
  const statTypes: FbrefStatType[] = requestedStats
    ? (requestedStats.split(",") as FbrefStatType[])
    : ["passing", "possession", "defense", "misc"];

  if (ids.hasFbref) {
    for (const st of statTypes) {
      try {
        const records = fbrefPlayerStats(ids.slug, fbrefSeason, st);
        if (records) playerStats[st] = records;
      } catch {
        // fichier pas encore scrapé — silencieux
      }
    }
  }

  // ── 3. Understat players ──
  let understatPlayersData: UnderstatPlayer[] | null = null;
  if (ids.hasUnderstat) {
    try {
      understatPlayersData = understatPlayers(ids.slug);
    } catch {
      // pas encore dispo
    }
  }

  // ── 3b. Merge Understat + FBref players (fuzzy match par nom) ──
  if (understatPlayersData && understatPlayersData.length > 0 && Object.keys(playerStats).length > 0) {
    // Index FBref par nom normalisé
    const fbrefIndex = new Map<string, Record<string, unknown>>();
    for (const [_statType, records] of Object.entries(playerStats)) {
      for (const r of records) {
        const name = normalizeName(String((r as any).Player ?? ""));
        if (name) fbrefIndex.set(name, r as Record<string, unknown>);
      }
    }
    // Enrichir chaque joueur Understat avec les stats FBref
    understatPlayersData = understatPlayersData.map((p) => {
      const n = normalizeName(p.player_name ?? "");
      const fbref = fbrefIndex.get(n);
      if (!fbref) return p;
      return {
        ...p,
        tackles: Number(fbref["Tkl"]) ?? null,
        interceptions: Number(fbref["Int"]) ?? null,
        blocks: Number(fbref["Blocks"]) ?? null,
        clearances: Number(fbref["Clr"]) ?? null,
        touches: Number(fbref["Touches"]) ?? null,
        progressive_passes: Number(fbref["PrgP"]) ?? null,
      };
    });
  }

  // ── 4. xG ranking ──
  let xgRanking: unknown[] | null = null;
  if (ids.hasUnderstat) {
    try {
      xgRanking = leagueXgRanking(ids.slug, season, location as any);
    } catch {
      // pas dispo
    }
  }

  // ── 5. Market sections (OddAlerts) ──
  let marketSections: unknown[] | null = null;
  try {
    const oddalertsData = getLeague(country, urlSlug);
    if (oddalertsData?.sections) {
      marketSections = oddalertsData.sections;
    }
  } catch {
    // pas dispo
  }

  // ── Response ──
  const response: FullLeagueResponse = {
    league: {
      slug: ids.slug,
      name: ids.info?.name ?? urlSlug,
      country: ids.info?.country ?? country,
      sources: {
        bsd: ids.hasBsd,
        fbref: ids.hasFbref,
        understat: ids.hasUnderstat,
      },
    },
    standings,
    playerStats,
    understatPlayers: understatPlayersData,
    xgRanking,
    marketSections,
    meta: {
      computedAt: new Date().toISOString(),
      cacheTtl: CACHE_TTL / 1000,
    },
  };

  lruSet(cacheKey, response);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
    },
  });
}
