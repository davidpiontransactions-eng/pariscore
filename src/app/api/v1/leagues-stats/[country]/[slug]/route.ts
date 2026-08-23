import { NextRequest, NextResponse } from "next/server";
import { getLeague } from "@/lib/leagues-stats/db";

// Détail d'une ligue : /api/v1/leagues-stats/[country]/[slug]
// Ex: /api/v1/leagues-stats/england/premier-league
// Données statiques quotidiennes → cache mémoire 30 min + headers CDN.

const CACHE_TTL = 30 * 60_000;

const _cache = new Map<
  string,
  { at: number; data: ReturnType<typeof getLeague> }
>();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ country: string; slug: string }> }
) {
  const { country, slug } = await params;
  const key = `${country}/${slug}`;

  let entry = _cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL) {
    entry = { at: Date.now(), data: getLeague(country, slug) };
    _cache.set(key, entry);
  }

  if (!entry.data) {
    return NextResponse.json(
      { error: `Ligue introuvable: ${key}` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { league: entry.data },
    { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } }
  );
}
