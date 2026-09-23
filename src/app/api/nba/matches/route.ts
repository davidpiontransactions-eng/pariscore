import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

type Payload = { matches: unknown[]; topBets: unknown[]; source: string };

// Fix debug 2026-09-23 : `let cache` module → createTtlCache (pattern
// multi-worker du VPS, cf. cached-route.ts) + jamais de cache sur réponse vide
// (un blip ESPN ne doit pas vider la liste pendant 5 min).
const CACHE_TTL = 5 * 60_000;
const cache = createTtlCache<Payload>("__nbaMatchesCache");

export async function GET() {
  const cached = cache.getEntry();
  if (isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached!.data);
  }

  try {
    const basketballService = require("../../../../../services/basketballService");
    const matches = await basketballService.getNbaMatches();

    // Réponse upstream vide + cache stale disponible → sert le stale plutôt que le vide
    if (!Array.isArray(matches) || matches.length === 0) {
      if (cached) return NextResponse.json(cached.data);
      const empty: Payload = { matches: [], topBets: [], source: "espn" };
      return NextResponse.json(empty); // non caché : prochain appel retente
    }

    const topBets = basketballService.computeNbaTopBets?.(matches, 3) ?? [];
    const data: Payload = { matches, topBets, source: "espn" };
    cache.set(data);
    return NextResponse.json(data);
  } catch (err) {
    // Erreur upstream + cache stale → sert le stale
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(
      { error: "nba data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
