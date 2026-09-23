import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

// GET /api/v1/search?q=<query>&limit=10
// Recherche unifiée : ligues (pariscore.db) + matches football (API-football) + tennis (BSD)
// Cache mémoire 60s — les données live ne changent que toutes les 60s.

const CACHE_TTL = 60_000;
const MIN_QUERY_LEN = 2;

type SearchResult = {
  id: string;
  name: string;
  subtitle?: string;
  icon: "match" | "team" | "league";
  sport?: string;
  href?: string;
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
  updatedAt: string;
};

type BSD = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
  close: () => void;
};

const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

let _db: BSD | null = null;
let _dbUnavailable = false;

function getDb(): BSD | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- détection runtime Bun (bun:sqlite) vs Node (better-sqlite3)
    const { Database } = require("bun:sqlite") as {
      Database: new (file: string, opts?: object) => BSD;
    };
    _db = new Database(SQLITE_FILE, { readonly: true });
    return _db;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- fallback Node quand bun:sqlite indisponible
      const Database = require("better-sqlite3") as unknown as {
        new (
          file: string,
          opts?: { readonly?: boolean; fileMustExist?: boolean }
        ): BSD;
      };
      _db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
      return _db;
    } catch {
      _dbUnavailable = true;
      return null;
    }
  }
}

// Cache mémoire simple
let _cache: { key: string; data: SearchResponse; at: number } | null = null;

function searchLeagues(q: string, limit: number): SearchResult[] {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT id, country, slug, leagueName, logoUrl, gamesPlayed
       FROM league_season_stats
       WHERE leagueName LIKE ? OR country LIKE ?
       ORDER BY gamesPlayed DESC
       LIMIT ?`
    )
    .all(`%${q}%`, `%${q}%`, limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: `league-${r.id}`,
    name: String(r.leagueName),
    subtitle: `${String(r.country)} · ${Number(r.gamesPlayed)} matchs`,
    icon: "league" as const,
    sport: "football",
    href: `/ligues/${String(r.country).toLowerCase()}/${String(r.slug)}`,
  }));
}

async function searchFootballMatches(
  q: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) return [];

    // Chercher les équipes dont le nom contient la requête
    const res = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(q)}`,
      {
        headers: { "x-apisports-key": apiKey },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: Array<{
        team: { id: number; name: string; logo: string; country: string };
        venue?: { city?: string };
      }>;
    };

    return (data.response ?? []).slice(0, limit).map((t) => ({
      id: `team-${t.team.id}`,
      name: t.team.name,
      subtitle: t.team.country,
      icon: "team" as const,
      sport: "football",
      href: `/matchs?team=${t.team.id}`,
    }));
  } catch {
    return [];
  }
}

async function searchTennis(
  q: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/tennis/search?q=${encodeURIComponent(q)}&type=all&limit=${limit}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return [];
    const data = (await res.json()) as {
      players?: Array<{
        name: string;
        slug: string;
        rank?: number;
        country?: string;
        circuit?: string;
      }>;
      tournaments?: Array<{
        name: string;
        slug: string;
        surface?: string;
        country?: string;
      }>;
    };

    const results: SearchResult[] = [];

    for (const p of (data.players ?? []).slice(0, limit)) {
      results.push({
        id: `player-${p.slug}`,
        name: p.name,
        subtitle: `${p.circuit ?? "ATP"} · ${p.country ?? ""} ${p.rank ? `· #${p.rank}` : ""}`.trim(),
        icon: "team",
        sport: "tennis",
        href: `/tennis?player=${p.slug}`,
      });
    }

    for (const t of (data.tournaments ?? []).slice(0, limit)) {
      results.push({
        id: `tournament-${t.slug}`,
        name: t.name,
        subtitle: `${t.surface ?? ""} · ${t.country ?? ""}`.trim(),
        icon: "league",
        sport: "tennis",
        href: `/tennis?tournament=${t.slug}`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 10),
    20
  );

  if (q.length < MIN_QUERY_LEN) {
    return NextResponse.json<SearchResponse>({
      results: [],
      total: 0,
      query: q,
      updatedAt: new Date().toISOString(),
    });
  }

  // Cache hit ?
  const cacheKey = `${q.toLowerCase()}:${limit}`;
  if (_cache && _cache.key === cacheKey && Date.now() - _cache.at < CACHE_TTL) {
    return NextResponse.json(_cache.data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  // Recherche en parallèle : ligues (local DB) + football (API) + tennis (interne)
  const [leagues, footballTeams, tennisResults] = await Promise.all([
    Promise.resolve(searchLeagues(q, limit)),
    searchFootballMatches(q, limit),
    searchTennis(q, limit),
  ]);

  const results = [...leagues, ...footballTeams, ...tennisResults].slice(
    0,
    limit
  );

  const response: SearchResponse = {
    results,
    total: results.length,
    query: q,
    updatedAt: new Date().toISOString(),
  };

  _cache = { key: cacheKey, data: response, at: Date.now() };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
