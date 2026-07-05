import { NextResponse } from "next/server";
import { MATCHES, type TennisMatch, type BookmakerOdd } from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";

// In-memory cache (60s TTL) — prevents hammering The Odds API
type CacheEntry = { data: TennisMatch[]; at: number };
const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

// Simple in-memory lock to avoid duplicate concurrent fetches
let inflight: Promise<TennisMatch[]> | null = null;

/**
 * GET /api/tennis/prematch
 *
 * Returns upcoming tennis matches with REAL predicted probabilities computed
 * by our Elo+Forme+Surface+H2H engine, plus multi-bookmaker odds (vig-removed).
 *
 * Strategy:
 *   1. Return cached data if fresh (≤ 60s)
 *   2. Fetch odds from The Odds API if ODDS_API_KEY is set
 *   3. Otherwise use enriched mock odds (5 bookmakers per match)
 *   4. ALWAYS compute probA/probB/IC/confidence from our prediction engine
 *      (do NOT trust bookmaker implied probabilities for the displayed %)
 */
export async function GET() {
  const now = Date.now();

  // 1. Cache
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({
      matches: cache.data,
      source: "cache",
      updatedAt: new Date(cache.at).toISOString(),
    });
  }

  // 2. Try live API
  const apiKey = process.env.ODDS_API_KEY;
  if (apiKey && !inflight) {
    inflight = fetchFromOddsApi(apiKey).catch((err) => {
      console.error("[prematch] Odds API failed:", err);
      return null;
    });
  }

  let liveOdds: Map<string, BookmakerOdd[]> | null = null;
  if (inflight) {
    try {
      liveOdds = await inflight;
    } finally {
      inflight = null;
    }
  }

  // 3. Always recompute predictions from our engine
  const matches = MATCHES.map((m) => {
    const playerAInputs: PlayerInputs = {
      id: m.playerA.id,
      name: m.playerA.name,
      elo: m.playerA.elo,
      surfaceElo: m.playerA.surfaceElo ?? m.playerA.elo,
      form: m.playerA.form,
      h2h: parseH2H(m.stats.h2h), // wins/losses for player A
    };
    const playerBInputs: PlayerInputs = {
      id: m.playerB.id,
      name: m.playerB.name,
      elo: m.playerB.elo,
      surfaceElo: m.playerB.surfaceElo ?? m.playerB.elo,
      form: m.playerB.form,
      h2h: { won: parseH2H(m.stats.h2h).lost, lost: parseH2H(m.stats.h2h).won },
    };
    const pred = predict(playerAInputs, playerBInputs);

    // Merge live odds if available, else use mock allOdds
    const allOdds = liveOdds?.get(m.id) ?? m.allOdds ?? [];

    // Pick the best (highest) odds for each player — value bet indicator
    const bestA = allOdds.reduce((max, o) => (o.decimalA > max ? o.decimalA : max), 0);
    const bestB = allOdds.reduce((max, o) => (o.decimalB > max ? o.decimalB : max), 0);
    const bestBookmakerA = allOdds.find((o) => o.decimalA === bestA)?.bookmaker;
    const bestBookmakerB = allOdds.find((o) => o.decimalB === bestB)?.bookmaker;

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
        ? {
            bookmaker: allOdds[0].bookmaker,
            decimalA: allOdds[0].decimalA,
            decimalB: allOdds[0].decimalB,
          }
        : m.odds,
      // Stash best-value info for UI hints (not in the public type but useful)
      ...(bestBookmakerA ? { _bestOddsA: { bookmaker: bestBookmakerA, decimal: bestA } } : {}),
      ...(bestBookmakerB ? { _bestOddsB: { bookmaker: bestBookmakerB, decimal: bestB } } : {}),
    } as TennisMatch;
  });

  cache = { data: matches, at: now };

  return NextResponse.json({
    matches,
    source: liveOdds ? "odds-api" : "mock",
    updatedAt: new Date(now).toISOString(),
  });
}

function parseH2H(h2h: string): { won: number; lost: number } {
  const [won, lost] = h2h.split("-").map((n) => parseInt(n, 10));
  return { won: won || 0, lost: lost || 0 };
}

/**
 * Fetch upcoming tennis matches from The Odds API, return per-match odds
 * from ALL bookmakers (for the comparator).
 */
async function fetchFromOddsApi(
  apiKey: string
): Promise<Map<string, BookmakerOdd[]> | null> {
  const url = `https://api.the-odds-api.com/v4/sports/tennis_atp_singles/odds/?apiKey=${apiKey}&regions=eu&oddsFormat=decimal`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    console.error(`[prematch] Odds API HTTP ${res.status}`);
    return null;
  }
  const raw = (await res.json()) as OddsApiMatch[];
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const result = new Map<string, BookmakerOdd[]>();
  for (const m of MATCHES) {
    const apiMatch = raw.find(
      (r) =>
        r.bookmakers?.[0]?.markets?.[0]?.outcomes?.some(
          (o) => o.name === m.playerA.name
        )
    );
    if (!apiMatch) continue;

    const odds: BookmakerOdd[] = [];
    for (const bm of apiMatch.bookmakers ?? []) {
      const market = bm.markets?.[0];
      if (!market) continue;
      const outcomeA = market.outcomes.find((o) => o.name === m.playerA.name);
      const outcomeB = market.outcomes.find((o) => o.name === m.playerB.name);
      if (!outcomeA?.price || !outcomeB?.price) continue;

      const invA = 1 / outcomeA.price;
      const invB = 1 / outcomeB.price;
      const vig = invA + invB;
      const impliedProbA = Math.round((invA / vig) * 100);
      odds.push({
        bookmaker: bm.title,
        decimalA: outcomeA.price,
        decimalB: outcomeB.price,
        impliedProbA,
        impliedProbB: 100 - impliedProbA,
        margin: Math.round((vig - 1) * 1000) / 1000,
      });
    }
    if (odds.length > 0) result.set(m.id, odds);
  }
  return result;
}

type OddsApiMatch = {
  id: string;
  commence_time: string;
  bookmakers?: {
    title: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number }[];
    }[];
  }[];
};
