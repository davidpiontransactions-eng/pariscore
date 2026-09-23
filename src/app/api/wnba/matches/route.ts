import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

type Payload = { matches: unknown[]; topBets: unknown[]; source: string };

// Fix debug 2026-09-23 : `let cache` module → createTtlCache (multi-worker) +
// jamais de cache sur réponse vide (blip ESPN ≠ liste vide 5 min).
const CACHE_TTL = 5 * 60_000;
const cache = createTtlCache<Payload>("__wnbaMatchesCache");

export async function GET() {
  const cached = cache.getEntry();
  if (isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached!.data);
  }

  try {
    const wnbaService = require("../../../../../services/wnbaService");
    const matches = await wnbaService.getWnbaMatches();

    // Réponse upstream vide + cache stale disponible → sert le stale plutôt que le vide
    if (!Array.isArray(matches) || matches.length === 0) {
      if (cached) return NextResponse.json(cached.data);
      const empty: Payload = { matches: [], topBets: [], source: "espn" };
      return NextResponse.json(empty); // non caché : prochain appel retente
    }

    const topBets = wnbaService.computeNbaTopBets?.(matches, 3) ?? [];
    const data: Payload = { matches, topBets, source: "espn" };
    cache.set(data);
    return NextResponse.json(data);
  } catch (err) {
    // Erreur upstream + cache stale → sert le stale
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(
      { error: "wnba data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
