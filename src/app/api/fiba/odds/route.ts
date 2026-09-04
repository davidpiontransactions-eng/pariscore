import { NextRequest, NextResponse } from "next/server";
import { fetchRealOdds } from "@/lib/predictions/fiba-odds";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";
import { validateSearchParams, oddsParamsSchema, isValidTeamAbbr } from "@/lib/api/validation";

/**
 * API Route pour les cotes FIBA Women's WC 2026.
 * 
 * Sources:
 * - The Odds API (gratuit: 500 requêtes/mois)
 * - Simulation réaliste (fallback)
 * 
 * Usage:
 * GET /api/fiba/odds?home=USA&away=CZE
 */

const ODDS_API_KEY = process.env.ODDS_API_KEY;

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitResult = rateLimits.odds(`odds:${ip}`);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetAt.toString(),
        },
      },
    );
  }

  // Validation
  const searchParams = request.nextUrl.searchParams;
  const validation = validateSearchParams(searchParams, oddsParamsSchema);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: validation.error },
      { status: 400 },
    );
  }

  const { home, away } = validation.data;

  if (!isValidTeamAbbr(home) || !isValidTeamAbbr(away)) {
    return NextResponse.json(
      { error: "Invalid team abbreviation" },
      { status: 400 },
    );
  }

  const cacheConfig = fibaCache.odds(home, away);
  const cached = cache.get(cacheConfig.key);
  
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      },
    });
  }

  try {
    // Essayer de récupérer les vraies cotes si clé API disponible
    const odds = await fetchRealOdds(home, away, ODDS_API_KEY);
    
    if (!odds) {
      return NextResponse.json(
        { error: "Failed to fetch odds" },
        { status: 500 },
      );
    }

    const data = {
      odds,
      source: ODDS_API_KEY ? "the-odds-api" : "simulation",
    };

    cache.set(cacheConfig.key, data, cacheConfig.ttl);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching odds:", error);
    return NextResponse.json(
      { error: "Failed to fetch odds" },
      { status: 500 },
    );
  }
}
