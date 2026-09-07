// GET /api/tennis/tournament/[slug]/contenders-matches?year=2026
//
// Top 10 prétendants (forecast) + croisation avec les matchs prematch/live.
// Utilise better-sqlite3 pour le forecast, fetch interne pour les matchs.
// Cache 10 min. Si aucun match annoncé, retourne le top 10 sans match.

import path from "node:path";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL_MS = 10 * 60_000;
const cache = createTtlCache<{ slug: string; year: number; contenders: ContenderMatch[] }>(
  "__contendersMatchesCache",
);

type BSD = {
  prepare: (sql: string) => { all: (...p: unknown[]) => unknown[] };
  close: () => void;
};

function getDb(): BSD | null {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");
  if (!fs.existsSync(dbPath)) return null;
  try {
    // Accès direct à Bun.sqlite via globalThis (pas de require/import = pas de Turbopack resolution)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BunSqlite = (globalThis as any).Bun?.sqlite;
    if (!BunSqlite) return null;
    return new BunSqlite.Database(dbPath, { readonly: true }) as unknown as BSD;
  } catch {
    return null;
  }
}

interface ContenderMatch {
  rank: number;
  name: string;
  seed?: number;
  country?: string;
  probWin?: number;
  match?: {
    opponent: string;
    round: string;
    scheduledAt?: string;
    score?: string;
    status: "upcoming" | "live" | "completed";
    tournament: string;
  };
}

/** Slugs → noms de tournoi dans le flux BSD. */
const TOURNAMENT_NAME_MAP: Record<string, string[]> = {
  "us-open": ["US Open", "US Open, Men"],
  "us-open-women": ["US Open, Women", "US Open"],
};

const INTERNAL_BASE = process.env.INTERNAL_API_URL || "http://127.0.0.1:3000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(_request.url);
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!, 10)
      : new Date().getFullYear();

    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data.slug === slug && cached.data.year === year) {
      return NextResponse.json(cached.data);
    }

    let db: BSD | null = null;
    try {
      db = getDb();
      if (!db) {
        console.error(`[contenders-matches] DB unavailable for slug=${slug}`);
        return NextResponse.json({ slug, year, contenders: [] }, { status: 200 });
      }

      // Top 10 prétendants
      const top10 = db.prepare(
        `SELECT player_name, player_seed, player_country, prob_win
         FROM tennis_draw_forecast
         WHERE tournament_slug = ? AND year = ?
         ORDER BY prob_win DESC NULLS LAST
         LIMIT 10`,
      ).all(slug, year) as { player_name: string; player_seed: number | null; player_country: string | null; prob_win: number | null }[];

      if (top10.length === 0) {
        return NextResponse.json({ slug, year, contenders: [] });
      }

      // Fetch matchs prematch + live (timeout court, fallback = pas de matchs)
      const tournamentNames = TOURNAMENT_NAME_MAP[slug] ?? [];
      let allMatches: Array<Record<string, unknown>> = [];

      const fetchOpts = { signal: AbortSignal.timeout(5000), cache: "no-store" as const };

      try {
        const r = await fetch(`${INTERNAL_BASE}/api/tennis/prematch`, fetchOpts);
        if (r.ok) { const d = await r.json(); allMatches.push(...(d?.matches ?? [])); }
      } catch { /* indisponible */ }

      try {
        const r = await fetch(`${INTERNAL_BASE}/api/tennis/live`, fetchOpts);
        if (r.ok) { const d = await r.json(); allMatches.push(...(d?.matches ?? [])); }
      } catch { /* indisponible */ }

      // Filtrer par tournoi
      const relevant = allMatches.filter((m) => {
        const t = (m.tournament as string) ?? "";
        return tournamentNames.some((tn) => t.includes(tn));
      });

      // Croiser
      const contenders: ContenderMatch[] = top10.map((p, i) => {
        const nl = p.player_name.toLowerCase();
        const match = relevant.find((m) => {
          const a = ((m.playerA as Record<string, unknown>)?.name as string ?? "").toLowerCase();
          const b = ((m.playerB as Record<string, unknown>)?.name as string ?? "").toLowerCase();
          return a === nl || b === nl || a.includes(nl) || nl.includes(a) || b.includes(nl) || nl.includes(b);
        });

        return {
          rank: i + 1,
          name: p.player_name,
          seed: p.player_seed ?? undefined,
          country: p.player_country ?? undefined,
          probWin: p.prob_win ?? undefined,
          ...(match ? {
            match: {
              opponent: (((match.playerA as Record<string, unknown>)?.name as string ?? "").toLowerCase() === nl)
                ? ((match.playerB as Record<string, unknown>)?.name as string ?? "—")
                : ((match.playerA as Record<string, unknown>)?.name as string ?? "—"),
              round: (match.tournament as string) ?? "",
              scheduledAt: (match.scheduledAt as string) ?? undefined,
              score: (match.score as string) ?? undefined,
              status: (match.live_stats || match.currentPoint) ? "live" : match.score ? "completed" : "upcoming",
              tournament: (match.tournament as string) ?? "",
            },
          } : {}),
        };
      });

      const data = { slug, year, contenders };
      cache.set(data);
      return NextResponse.json(data);
    } catch (e) {
      console.error(`[contenders-matches] upstream failed for slug=${slug}:`, e);
      return NextResponse.json({ slug, year, contenders: [] }, { status: 200 });
    } finally {
      db?.close();
    }
  } catch (err) {
    console.error(`[contenders-matches] unexpected error:`, err);
    return NextResponse.json({ contenders: [] }, { status: 200 });
  }
}
