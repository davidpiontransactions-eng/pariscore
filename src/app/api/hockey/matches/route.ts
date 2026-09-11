import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 5 * 60_000;

type CachePayload = {
  matches: unknown[];
  source: string;
  degraded: boolean;
};

const cache = createTtlCache<CachePayload | null>("__hockeyMatchesCache");

async function fetchSkipOdds(): Promise<unknown[]> {
  try {
    const res = await fetch("https://skipodds.com/v1/hockey", {
      method: "GET",
      headers: { "Accept": "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data && data.skipodds) {
      const { home, away } = data.skipodds;
      return [{
        id: "skipodds-auto",
        homeName: "Home",
        awayName: "Away",
        scheduledAt: new Date().toISOString(),
        isLive: false,
        leagueId: "skipodds",
        leagueName: "SkipOdds",
        countryName: "International",
        countryCode: "INT",
        oddsH: 1 / home,
        oddsA: 1 / away,
        probSkipH: home * 100,
        probSkipA: away * 100,
        source: "skipodds",
      }];
    }
    return [];
  } catch (e) {
    console.warn("[hockey] SkipOdds fetch failed:", e);
    return [];
  }
}

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
      id: m.id || m.event_id || m.match_id || "bsd-" + Math.random().toString(36).slice(2),
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

async function fetchAnnabetMock(): Promise<unknown[]> {
  try {
    const matchPath = join(process.cwd(), "data", "annabet_hockey_prematch.json");
    if (existsSync(matchPath)) {
      const data = JSON.parse(readFileSync(matchPath, "utf8"));
      const matches: unknown[] = [];
      // Structure: { leagues: { khl: { matches: [...] }, nhl: { matches: [...] }, ... } }
      if (data.leagues && typeof data.leagues === "object") {
        const leagues = data.leagues as Record<string, { matches?: Array<Record<string, unknown>> }>;
        for (const [leagueId, league] of Object.entries(leagues)) {
          if (league?.matches && Array.isArray(league.matches)) {
            for (const m of league.matches) {
              const odds = m.odds1X2 as Record<string, number> | undefined;
              matches.push({
                id: `annabet-${leagueId}-${m.team1Id ?? Math.random().toString(36).slice(2)}`,
                homeName: m.team1Name || "Home",
                awayName: m.team2Name || "Away",
                scheduledAt: m.date || null,
                isLive: false,
                leagueId,
                leagueName: leagueId.toUpperCase(),
                countryName: "International",
                countryCode: "INT",
                oddsH: odds?.home ?? null,
                oddsD: odds?.draw ?? null,
                oddsA: odds?.away ?? null,
                h2h: m.h2h || null,
                source: "annabet",
              });
            }
          }
        }
      }
      return matches;
    }
    return [];
  } catch (e) {
    console.warn("[hockey] Annabet fetch failed:", e);
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
    const [skipOddsMatches, bsdMatches, annabetMatches] = await Promise.all([
      fetchSkipOdds(),
      fetchBSDHockey(),
      fetchAnnabetMock(),
    ]);

    const allMatches = [...skipOddsMatches, ...bsdMatches, ...annabetMatches];
    const seen = new Set<string>();
    const deduped = allMatches.filter((m) => {
      const id = ((m as Record<string, unknown>).id as string) || "";
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const hasSkipOdds = skipOddsMatches.length > 0;
    const hasBSD = bsdMatches.length > 0;
    const hasAnnabet = annabetMatches.length > 0;
    const degraded = !(hasSkipOdds || hasBSD || hasAnnabet);

    const sourceParts: string[] = [];
    if (hasSkipOdds) sourceParts.push("skipodds");
    if (hasBSD) sourceParts.push("bsd");
    if (hasAnnabet) sourceParts.push("annabet");
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
