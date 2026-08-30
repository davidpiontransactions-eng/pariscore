// GET /api/tennis/tournament/[slug]/contenders-matches?year=2026
//
// Retourne les matchs à venir des 10 meilleurs prétendants (forecast)
// en croisant les données TennisAbstract avec le flux prematch/live BSD.
// Si aucun match n'est annoncé pour un prétendant, il est exclu du résultat.

import path from "node:path";
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL_MS = 10 * 60_000; // 10 min
const cache = createTtlCache<{ slug: string; year: number; contenders: ContenderMatch[] }>(
  "__contendersMatchesCache",
);

type BSD = {
  prepare: (sql: string) => { all: (...p: unknown[]) => unknown[]; get: (...p: unknown[]) => unknown };
  close: () => void;
};

function getDb(): BSD | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as unknown as {
      new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): BSD;
    };
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");
    return new Database(dbPath, { readonly: true, fileMustExist: true });
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
    opponentSeed?: number;
    opponentCountry?: string;
    round: string;
    scheduledAt?: string;
    score?: string;
    status: "upcoming" | "live" | "completed";
    tournament: string;
  };
}

/** Slugs TennisAbstract → noms de tournoi dans le flux BSD. */
const TOURNAMENT_NAME_MAP: Record<string, string[]> = {
  "us-open": ["US Open", "US Open, Men"],
  "us-open-women": ["US Open, Women", "US Open"],
};

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

    // Cache check
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data.slug === slug && cached.data.year === year) {
      return NextResponse.json(cached.data);
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "DB_UNAVAILABLE", message: "DB non disponible" }, { status: 503 });
    }

    try {
      // 1. Top 10 prétendants par probabilité de titre
      const top10 = db
        .prepare(
          `SELECT player_name, player_seed, player_country, prob_win
           FROM tennis_draw_forecast
           WHERE tournament_slug = ? AND year = ?
           ORDER BY prob_win DESC NULLS LAST
           LIMIT 10`,
        )
        .all(slug, year) as { player_name: string; player_seed: number | null; player_country: string | null; prob_win: number | null }[];

      if (top10.length === 0) {
        return NextResponse.json({ slug, year, contenders: [] });
      }

      // 2. Récupérer les matchs prematch + live depuis les APIs internes
      const tournamentNames = TOURNAMENT_NAME_MAP[slug] ?? [];
      let allMatches: Array<{
        playerA?: { name?: string }; playerB?: { name?: string };
        tournament?: string; scheduledAt?: string; score?: string;
        live_stats?: unknown; currentPoint?: unknown;
      }> = [];

      try {
        const prematchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/tennis/prematch`, {
          cache: "no-store",
        });
        const prematchData = await prematchRes.json();
        allMatches = [...allMatches, ...(prematchData?.matches ?? [])];
      } catch { /* prematch indisponible */ }

      try {
        const liveRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/tennis/live`, {
          cache: "no-store",
        });
        const liveData = await liveRes.json();
        allMatches = [...allMatches, ...(liveData?.matches ?? [])];
      } catch { /* live indisponible */ }

      // 3. Filtrer les matchs du tournoi concerné
      const relevantMatches = allMatches.filter((m) => {
        if (!m.tournament) return false;
        return tournamentNames.some((tn) => m.tournament!.includes(tn));
      });

      // 4. Croiser top 10 avec matchs
      const contenders: ContenderMatch[] = top10.map((p, i) => {
        const nameLower = p.player_name.toLowerCase();
        const match = relevantMatches.find((m) => {
          const aName = m.playerA?.name?.toLowerCase() ?? "";
          const bName = m.playerB?.name?.toLowerCase() ?? "";
          return aName === nameLower || bName === nameLower ||
                 aName.includes(nameLower) || nameLower.includes(aName) ||
                 bName.includes(nameLower) || nameLower.includes(bName);
        });

        return {
          rank: i + 1,
          name: p.player_name,
          seed: p.player_seed ?? undefined,
          country: p.player_country ?? undefined,
          probWin: p.prob_win ?? undefined,
          ...(match
            ? {
                match: {
                  opponent: match.playerA?.name?.toLowerCase() === nameLower
                    ? (match.playerB?.name ?? "—")
                    : (match.playerA?.name ?? "—"),
                  round: match.tournament ?? "",
                  scheduledAt: match.scheduledAt ?? undefined,
                  score: match.score ?? undefined,
                  status: !!(match as any).live_stats || !!(match as any).currentPoint
                    ? "live"
                    : match.score
                      ? "completed"
                      : "upcoming",
                  tournament: match.tournament ?? "",
                },
              }
            : {}),
        };
      });

      const data = { slug, year, contenders };
      cache.set(data);
      return NextResponse.json(data);
    } finally {
      db.close();
    }
  } catch (err) {
    return apiErrorHandler(err, "tennis/contenders-matches", () =>
      NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 }),
    );
  }
}
