import { NextResponse } from "next/server";
import { MATCHES, type TennisMatch, type BookmakerOdd } from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";
import { fetchRealMatches } from "@/lib/real-matches";
import { fetchBSDMatches } from "@/lib/bsd-fetcher";

// Cache config:
//   - BSD / Odds API: 5-minute TTL (API limits)
//   - Mock fallback: 60-second TTL
const CACHE_TTL_REAL_MS = 5 * 60_000;
const CACHE_TTL_MOCK_MS = 60_000;

type Source = "bsd" | "odds-api" | "mock";

type CacheEntry = {
  data: TennisMatch[];
  source: Source;
  at: number;
};
let cache: CacheEntry | null = null;

let inflight: Promise<TennisMatch[]> | null = null;

/**
 * GET /api/tennis/prematch
 *
 * Priority: BSD > The Odds API > Mock
 *
 * 1. BSD (sports.bzzoiro.com) — if BSD_API_KEY + BSD_TENNIS_ENABLED=true
 * 2. The Odds API — if ODDS_API_KEY set
 * 3. Mock fallback — enriched with real prediction engine
 */
export async function GET() {
  const now = Date.now();
  const bsdKey = process.env.BSD_API_KEY;
  const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
  const oddsKey = process.env.ODDS_API_KEY;

  // 1. Cache hit?
  if (cache && now - cache.at < cacheTtl(cache.source)) {
    return NextResponse.json({
      matches: cache.data,
      source: cache.source,
      updatedAt: new Date(cache.at).toISOString(),
    });
  }

  // 2. Try BSD first (priority source)
  if (bsdKey && bsdEnabled) {
    try {
      const bsdMatches = await fetchBSDMatches();
      cache = { data: bsdMatches, source: "bsd", at: now };
      console.log("[prematch] BSD source —", bsdMatches.length, "matches");
      return NextResponse.json({
        matches: bsdMatches,
        source: "bsd",
        updatedAt: new Date(now).toISOString(),
      });
    } catch (err) {
      console.error("[prematch] BSD failed, trying Odds API:", (err as Error).message);
      // fall through to Odds API
    }
  }

  // 3. Try The Odds API
  if (oddsKey) {
    if (!inflight) {
      inflight = fetchRealMatches(oddsKey).catch((err) => {
        console.error("[prematch] fetchRealMatches failed:", err.message);
        throw err;
      });
    }
    try {
      const realMatches = await inflight;
      inflight = null;
      cache = { data: realMatches, source: "odds-api", at: now };
      return NextResponse.json({
        matches: realMatches,
        source: "odds-api",
        updatedAt: new Date(now).toISOString(),
      });
    } catch (err) {
      inflight = null;
      console.error("[prematch] Odds API failed, falling back to mock:", (err as Error).message);
    }
  }

  // 4. Mock fallback
  const matches = MATCHES.map((m) => enrichMockMatch(m));
  cache = { data: matches, source: "mock", at: now };
  return NextResponse.json({
    matches,
    source: "mock",
    updatedAt: new Date(now).toISOString(),
  });
}

function cacheTtl(source: Source): number {
  return source === "mock" ? CACHE_TTL_MOCK_MS : CACHE_TTL_REAL_MS;
}

function enrichMockMatch(m: TennisMatch): TennisMatch {
  const h2hA = parseH2H(m.stats.h2h);
  const playerAInputs: PlayerInputs = {
    id: m.playerA.id,
    name: m.playerA.name,
    elo: m.playerA.elo,
    surfaceElo: m.playerA.surfaceElo ?? m.playerA.elo,
    form: m.playerA.form,
    h2h: h2hA,
  };
  const playerBInputs: PlayerInputs = {
    id: m.playerB.id,
    name: m.playerB.name,
    elo: m.playerB.elo,
    surfaceElo: m.playerB.surfaceElo ?? m.playerB.elo,
    form: m.playerB.form,
    h2h: { won: h2hA.lost, lost: h2hA.won },
  };
  const pred = predict(playerAInputs, playerBInputs);

  const allOdds: BookmakerOdd[] = m.allOdds ?? [];

  return {
    ...m,
    probA: pred.probA,
    probB: pred.probB,
    stats: {
      ...m.stats,
      ic: pred.ic,
      confidence: pred.confidence,
      eloGap: pred.eloGap,
    },
    model: pred.model,
    allOdds,
    odds: allOdds[0]
      ? { bookmaker: allOdds[0].bookmaker, decimalA: allOdds[0].decimalA, decimalB: allOdds[0].decimalB }
      : m.odds,
  } as TennisMatch;
}

function parseH2H(h2h: string): { won: number; lost: number } {
  const [won, lost] = h2h.split("-").map((n) => parseInt(n, 10));
  return { won: won || 0, lost: lost || 0 };
}
