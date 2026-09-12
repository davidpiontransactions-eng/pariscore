/* ─── Adaptateur unifié de sources sportives ───
   Chaîne: BSD Sports (primaire payant) → API-Football (fallback gratuit) → ESPN (timeline gratuit)
           → SportMonks (standings détaillés, sous clé) → Scrapling (stealth)
   Principe : jamais de throw — null/[] en cas d'échec, routes retombent en 200 dégradé.
   Utilisé par /api/football/prematch et /api/football/matches/[id]/stats.
*/

import type { FootballMatch } from "@/lib/football-data";
import { fetchBSDFootballPrematch, fetchBSDMatchStats, fetchBSDFootballMatchMeta } from "@/lib/bsd-football-fetcher";
import { fetchApiFootballMatchStats, type ApiFootballMatchStats } from "@/lib/api-football-stats";
import { resolveESPNEvent, fetchESPNTimeline, type ESPNResolvedEvent, type ESPNTimelineReport } from "@/lib/espn-soccer-fetcher";

/** Résultat structuré — jamais d'exception. */
export type SourceResult<T> = {
  data: T | null;
  status: "success" | "degraded" | "unavailable";
  source: string;
  fetchedAt: string;
};

type CacheEntry = { data: unknown; at: number };

const PREMATCH_TTL = 5 * 60_000;
const STATS_TTL = 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

function isStale(entry: CacheEntry | undefined, ttl: number): boolean {
  return !entry || Date.now() - entry.at > ttl;
}

/** Singleton cache mémoire (Map sur globalThis pour multi-worker). */
const g = globalThis as unknown as { __dsaCache?: Map<string, CacheEntry> };
const mem: Map<string, CacheEntry> = g.__dsaCache ?? new Map();
if (!g.__dsaCache) g.__dsaCache = mem;

export class FootballDataAdapter {
  /** Prematch avec fallback : BSD → cache dégradé. API-Football/ESPN sont per-match (pas de fixture). */
  async getPrematchMatches(): Promise<SourceResult<FootballMatch[]>> {
    const key = "__dsa:prematch";
    const hit = mem.get(key);
    if (hit && !isStale(hit, PREMATCH_TTL)) {
      return { data: hit.data as FootballMatch[], status: "success", source: "bsd:cache", fetchedAt: nowIso() };
    }
    try {
      const data = await fetchBSDFootballPrematch();
      if (Array.isArray(data) && data.length > 0) {
        mem.set(key, { data, at: Date.now() });
        return { data, status: "success", source: "bsd", fetchedAt: nowIso() };
      }
    } catch (e) {
      console.warn("[data-adapter] BSD prematch failed:", (e as Error).message);
    }
    // Pas de fallback fixtures : on sert le cache même stale si dispo
    if (hit?.data) {
      return { data: hit.data as FootballMatch[], status: "degraded", source: "bsd:stale", fetchedAt: nowIso() };
    }
    return { data: null, status: "unavailable", source: "bsd", fetchedAt: nowIso() };
  }

  /** Stats per-match : BSD (momentum/xG) + ESPN (commentary) + API-Football (totaux). Jamais de throw. */
  async getMatchStats(matchId: string): Promise<
    SourceResult<{ bsd: Awaited<ReturnType<typeof fetchBSDMatchStats>> | null; espn: ESPNTimelineReport | null; api: ApiFootballMatchStats | null; meta: Awaited<ReturnType<typeof fetchBSDFootballMatchMeta>> | null }>
  > {
    const key = `__dsa:stats:${matchId}`;
    const hit = mem.get(key);
    if (hit && !isStale(hit, STATS_TTL)) {
      return hit.data as SourceResult<{ bsd: any; espn: any; api: any; meta: any }>;
    }

    let bsd: Awaited<ReturnType<typeof fetchBSDMatchStats>> | null = null;
    let espn: ESPNTimelineReport | null = null;
    let api: ApiFootballMatchStats | null = null;
    let meta: Awaited<ReturnType<typeof fetchBSDFootballMatchMeta>> | null = null;

    try {
      bsd = await fetchBSDMatchStats(matchId);
    } catch (e) {
      console.warn(`[data-adapter] BSD stats ${matchId}:`, (e as Error).message);
    }

    try {
      meta = await fetchBSDFootballMatchMeta(matchId);
    } catch {
      /* meta best-effort */
    }

    // ESPN : nécessite meta (noms + date + league)
    if (meta) {
      try {
        const resolved: ESPNResolvedEvent | null = await resolveESPNEvent({
          homeTeam: meta.homeTeam,
          awayTeam: meta.awayTeam,
          date: meta.date,
          leagueId: meta.leagueId,
        });
        if (resolved) espn = await fetchESPNTimeline(resolved);
      } catch (e) {
        console.warn(`[data-adapter] ESPN ${matchId}:`, (e as Error).message);
      }
    }

    // API-Football : fallback totaux quand BSD+ESPN vides
    if (!bsd && !espn) {
      try {
        api = await fetchApiFootballMatchStats({
          homeTeam: meta?.homeTeam ?? "",
          awayTeam: meta?.awayTeam ?? "",
          date: meta?.date,
        });
      } catch (e) {
        console.warn(`[data-adapter] API-Football ${matchId}:`, (e as Error).message);
      }
    }

    const ok = !!(bsd || espn || api || meta);
    const result: SourceResult<{ bsd: any; espn: any; api: any; meta: any }> = {
      data: { bsd, espn, api, meta },
      status: bsd || espn ? "success" : ok ? "degraded" : "unavailable",
      source: bsd ? (espn ? "bsd+espn" : "bsd") : espn ? "espn" : api ? "api-football" : "none",
      fetchedAt: nowIso(),
    };
    mem.set(key, { data: result, at: Date.now() });
    return result;
  }

  /** Résolution ESPN isolée (utilisable pour cache DB espnEventId). */
  async resolveESPNMatch(homeTeam: string, awayTeam: string, date: string, leagueId: number): Promise<ESPNResolvedEvent | null> {
    try {
      return await resolveESPNEvent({ homeTeam, awayTeam, date, leagueId });
    } catch (e) {
      console.warn("[data-adapter] ESPN resolve failed:", (e as Error).message);
      return null;
    }
  }
}

export const footballDataAdapter = new FootballDataAdapter();
