import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { MATCHES, type TennisMatch, type BookmakerOdd } from "@/lib/tennis-data";
import { predict, type PlayerInputs } from "@/lib/prediction/engine";

// NOTE: bsd-fetcher and real-matches are loaded dynamically inside try/catch
// to prevent a top-level import crash from taking down the entire route.
// The mock fallback (MATCHES + predict) is always available.

const CACHE_TTL_REAL_MS = 5 * 60_000;
const CACHE_TTL_MOCK_MS = 60_000;

// Grâce temporelle: un match dont scheduledAt est dans le passé au-delà de
// 30 min est exclu de la prematch (insensible au fuseau — comparaison d'epoch ms).
// Absorbe drift horloge + délai de détection live. Conserve les dates
// manquantes (Date.parse → NaN) pour ne pas masquer par excès.
const PAST_GRACE_MS = 30 * 60_000;

type Source = "bsd" | "odds-api" | "mock";

type CacheEntry = {
  data: TennisMatch[];
  source: Source;
  at: number;
};
let cache: CacheEntry | null = null;

let inflight: Promise<TennisMatch[]> | null = null;

/**
 * Garde-fou temporel — exclut les matchs dont scheduledAt est dans le passé
 * au-delà de la période de grâce (30 min). Insensible au fuseau (comparaison
 * d'epoch ms). Conserve les matchs à date manquante (Date.parse → NaN) pour
 * ne pas masquer par excès. Prévient les "matchs fantômes" si un fournisseur
 * renvoie un statut non-terminal pour un match déjà joué.
 */
function filterStaleMatches(matches: TennisMatch[]): TennisMatch[] {
  const cutoff = Date.now() - PAST_GRACE_MS;
  return matches.filter((m) => {
    const ms = Date.parse(m.scheduledAt);
    return !Number.isFinite(ms) || ms >= cutoff;
  });
}

/**
 * GET /api/tennis/prematch
 *
 * Priority: BSD > The Odds API > Mock
 *
 * Bulletproof: the entire handler is wrapped in try/catch.
 * If EVERYTHING fails, mock data is returned (3 demo matches).
 */
export async function GET() {
  try {
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

    // 2. Try BSD first (priority source) — dynamic import
    if (bsdKey && bsdEnabled) {
      try {
        const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
        const bsdMatches = filterStaleMatches(await fetchBSDMatches());
        cache = { data: bsdMatches, source: "bsd", at: now };
        console.log("[prematch] BSD source —", bsdMatches.length, "matches");
        return NextResponse.json({
          matches: bsdMatches,
          source: "bsd",
          updatedAt: new Date(now).toISOString(),
        });
      } catch (err) {
        console.error("[prematch] BSD failed:", (err as Error).message);
        // fall through to Odds API
      }
    }

    // 3. Try The Odds API — dynamic import
    if (oddsKey) {
      try {
        if (!inflight) {
          const { fetchRealMatches } = await import("@/lib/real-matches");
          inflight = fetchRealMatches(oddsKey).catch((err) => {
            console.error("[prematch] fetchRealMatches failed:", err.message);
            throw err;
          });
        }
        try {
          const realMatches = filterStaleMatches(await inflight);
          inflight = null;
          cache = { data: realMatches, source: "odds-api", at: now };
          return NextResponse.json({
            matches: realMatches,
            source: "odds-api",
            updatedAt: new Date(now).toISOString(),
          });
        } catch (err) {
          inflight = null;
          console.error("[prematch] Odds API failed:", (err as Error).message);
        }
      } catch (err) {
        inflight = null;
        console.error("[prematch] Odds API module failed:", (err as Error).message);
      }
    }

    // 4. Mock fallback — ALWAYS works
    return mockResponse(now);
  } catch (fatalErr) {
    return apiErrorHandler(fatalErr, "tennis/prematch", () => mockResponse(Date.now()));
  }
}

function mockResponse(now: number): NextResponse {
  try {
    const matches = filterStaleMatches(MATCHES.map((m) => enrichMockMatch(m)));
    cache = { data: matches, source: "mock", at: now };
    return NextResponse.json({
      matches,
      source: "mock",
      updatedAt: new Date(now).toISOString(),
    });
  } catch {
    // If even enrichMockMatch crashes, return raw MATCHES without enrichment
    console.error("[prematch] enrichMockMatch failed — returning raw matches");
    return NextResponse.json({
      matches: MATCHES,
      source: "mock",
      updatedAt: new Date(now).toISOString(),
    });
  }
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
