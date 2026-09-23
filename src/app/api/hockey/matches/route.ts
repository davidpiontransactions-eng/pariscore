import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { loadMergedPrematch } from "@/lib/hockey/prematch-data";

const CACHE_TTL = 5 * 60_000;

type CachePayload = {
  matches: unknown[];
  source: string;
  degraded: boolean;
};

const cache = createTtlCache<CachePayload | null>("__hockeyMatchesCache");

async function fetchBSDHockey(): Promise<unknown[]> {
  try {
    const BSD_BASE_URL = "https://sports.bzzoiro.com/api";
    const BSD_API_KEY = process.env.BSD_API_KEY || "";
    if (!BSD_API_KEY) return [];

    const fetchBSD = (endpoint: string): Promise<unknown[]> =>
      new Promise((resolve, reject) => {
        const url = `${BSD_BASE_URL}${endpoint}`;
        const req = fetch(url, {
          headers: {
            "Authorization": `Token ${BSD_API_KEY}`,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(20000),
        })
          .then((res) => {
            if (res.status === 429 || res.status >= 500) {
              return reject(new Error(`HTTP ${res.status}`));
            }
            return res.json();
          })
          .then((parsed) => resolve(parsed?.matches || parsed || []))
          .catch(reject);
      });

    const live = await fetchBSD("/hockey/api/v2/matches/live/").catch(() => [] as unknown[]);
    const predictions = await fetchBSD("/hockey/api/v2/predictions/").catch(() => [] as unknown[]);

    const normalizeBSDM = (m: Record<string, unknown>) => ({
      id: m.id || m.event_id || m.match_id || "bsd-" + String(m.home || m.homeTeam || "") + "-" + String(m.away || m.awayTeam || ""),
      homeName: m.home || m.homeTeam || "Home",
      awayName: m.away || m.awayTeam || "Away",
      scheduledAt: m.scheduled_at || m.start_time || m.date || null,
      isLive: !!m.live || !!m.status_live,
      leagueId: m.league_id || m.league || "hockey",
      leagueName: m.league_name || m.competition || "Hockey",
      countryName: m.country || m.country_name || "International",
      countryCode: m.country_code || "INT",
      oddsH: m.odds_home || m.odds1,
      oddsD: m.odds_draw || m.oddsX,
      oddsA: m.odds_away || m.odds2,
      probBSDH: m.prob_home,
      probBSD: m.prob_draw,
      probBSDA: m.prob_away,
      oddsBSDH: m.odds_home,
      oddsBSDD: m.odds_draw,
      oddsBSDA: m.odds_away,
      h2hUrl: m.h2h_url || null,
      source: "bsd",
    });

    const matches: unknown[] = [];
    for (const m of [...live, ...predictions]) {
      matches.push(normalizeBSDM(m as Record<string, unknown>));
    }
    return matches;
  } catch (e) {
    console.warn("[hockey] BSD fetch failed:", e);
    return [];
  }
}

async function fetchPrematchMatches(): Promise<unknown[]> {
  try {
    const data = loadMergedPrematch();
    if (!data) return [];
    const matches: unknown[] = [];
    for (const [leagueId, league] of Object.entries(data.leagues)) {
      if (league?.matches && Array.isArray(league.matches)) {
        for (const m of league.matches) {
          const odds = m.odds1X2;
          matches.push({
            id: `prematch-${leagueId}-${m.team1Id}-${m.team2Id}`,
            homeName: m.team1Name || "Home",
            awayName: m.team2Name || "Away",
            scheduledAt: m.date || "",
            isLive: false,
            leagueId,
            leagueName: leagueId.toUpperCase(),
            countryName: "International",
            countryCode: "INT",
            oddsH: odds?.home ?? null,
            oddsD: odds?.draw ?? null,
            oddsA: odds?.away ?? null,
            h2h: m.h2h || null,
            source: "prematch",
          });
        }
      }
    }
    return matches;
  } catch (e) {
    console.warn("[hockey] Prematch fetch failed:", e);
    return [];
  }
}

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
    });
  }

  try {
    const [bsdMatches, prematchMatches] = await Promise.all([
      fetchBSDHockey(),
      fetchPrematchMatches(),
    ]);

    const allMatches = [...bsdMatches, ...prematchMatches];
    const seen = new Set<string>();
    const deduped = allMatches.filter((m) => {
      const id = ((m as Record<string, unknown>).id as string) || "";
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const hasBSD = bsdMatches.length > 0;
    const hasPrematch = prematchMatches.length > 0;
    const degraded = !(hasBSD || hasPrematch);

    const sourceParts: string[] = [];
    if (hasBSD) sourceParts.push("bsd");
    if (hasPrematch) sourceParts.push("prematch");
    const source = sourceParts.length > 0 ? sourceParts.join("+") : "none";

    if (!degraded) {
      cache.set({ matches: deduped, source, degraded });
    }

    return NextResponse.json({
      matches: deduped,
      source,
      degraded,
    });
  } catch (err) {
    console.error("[hockey] fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "hockey data unavailable" }, { status: 503 });
  }
}
