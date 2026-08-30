// GET /api/tennis/tournament/[slug]/draw?year=2026
//
// Tableau forecast d'un tournoi TennisAbstract depuis pariscore.db.
// Pour les Grand Slams US Open, lit aussi `tennis_draw_bracket` (tnnslive.com)
// pour construire le bracket tree (matches).
// Lecture seule (better-sqlite3 readonly), cache 5 min via createTtlCache.

import path from "node:path";
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import type { TournamentDraw, ForecastRow, DrawMatch, DrawMatchPlayer, DrawRound } from "@/lib/types/tennis-draw";
import { ROUND_ORDER } from "@/lib/types/tennis-draw";

/** Métadonnées des tournois (nom, surface, catégorie). */
const TOURNAMENT_META: Record<string, { name: string; surface: string; category: string }> = {
  monterrey:        { name: "Monterrey Open",          surface: "Hard",        category: "WTA 500" },
  "australian-open": { name: "Australian Open",          surface: "Hard",        category: "Grand Slam" },
  "roland-garros":   { name: "Roland-Garros",            surface: "Clay",        category: "Grand Slam" },
  wimbledon:         { name: "Wimbledon",                surface: "Grass",       category: "Grand Slam" },
  "us-open":         { name: "US Open",                  surface: "Hard",        category: "Grand Slam" },
  "us-open-women":   { name: "US Open Women",            surface: "Hard",        category: "Grand Slam" },
  "indian-wells":    { name: "Indian Wells",             surface: "Hard",        category: "ATP/WTA 1000" },
  miami:             { name: "Miami Open",               surface: "Hard",        category: "ATP/WTA 1000" },
  "monte-carlo":     { name: "Monte-Carlo Masters",      surface: "Clay",        category: "ATP 1000" },
  madrid:            { name: "Madrid Open",              surface: "Clay",        category: "ATP/WTA 1000" },
  rome:              { name: "Italian Open",             surface: "Clay",        category: "ATP/WTA 1000" },
  canada:            { name: "Canadian Open",            surface: "Hard",        category: "ATP/WTA 1000" },
  cincinnati:        { name: "Cincinnati Masters",       surface: "Hard",        category: "ATP/WTA 1000" },
  shanghai:          { name: "Shanghai Masters",         surface: "Hard",        category: "ATP 1000" },
  paris:             { name: "Paris Masters",            surface: "Hard (indoor)", category: "ATP 1000" },
};

/** Taille de tableau par catégorie (approximatif, sert de fallback). */
const DRAW_SIZE_BY_CATEGORY: Record<string, number> = {
  "Grand Slam": 128,
  "ATP 1000": 56,
  "WTA 1000": 56,
  "ATP/WTA 1000": 56,
  "ATP 500": 32,
  "WTA 500": 32,
  "ATP 256": 28,
  "WTA 256": 28,
};

// Cache TTL 5 min (assez frais pour un tournoi en cours)
const CACHE_TTL_MS = 5 * 60_000;
const cache = createTtlCache<TournamentDraw>("__tennisDrawCache");

type BSD = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
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

interface DrawRow {
  player_name: string;
  player_seed: number | null;
  player_qualifier: string | null;
  player_country: string | null;
  player_ta_id: string | null;
  prob_r16: number | null;
  prob_qf: number | null;
  prob_sf: number | null;
  prob_f: number | null;
  prob_win: number | null;
  section: number;
  updated_at: string;
}

/** Ligne de la table tennis_draw_bracket (tnnslive.com). */
interface BracketRow {
  section: number;
  player_name: string;
  player_seed: number | null;
  player_country: string | null;
  qualifier: number;
  wildcard: number;
  round_r128: string | null;
  round_r64: string | null;
  round_r32: string | null;
  round_r16: string | null;
  round_qf: string | null;
  round_sf: string | null;
  round_f: string | null;
  round_w: string | null;
  updated_at: string;
}

function rowToForecast(row: DrawRow): ForecastRow {
  return {
    name: row.player_name,
    seed: row.player_seed ?? undefined,
    qualifier: row.player_qualifier ?? undefined,
    country: row.player_country ?? undefined,
    id: row.player_ta_id ?? undefined,
    probabilities: {
      R16: row.prob_r16 ?? undefined,
      QF: row.prob_qf ?? undefined,
      SF: row.prob_sf ?? undefined,
      F: row.prob_f ?? undefined,
      W: row.prob_win ?? undefined,
    },
  };
}

/** Construit le bracket tree (DrawMatch[]) depuis les lignes plates du bracket. */
function buildBracketFromRows(rows: BracketRow[]): DrawMatch[] {
  const matches: DrawMatch[] = [];
  // Taille du tableau = première puissance de 2 >= nombre de joueurs
  const drawSize = rows.length <= 128 ? 128 : rows.length <= 64 ? 64 : 32;
  const roundSizes: Record<DrawRound, number> = {
    R128: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1, W: 0,
  };

  // Map section → player pour lookup rapide
  const playerBySection = new Map<number, BracketRow>();
  for (const r of rows) playerBySection.set(r.section, r);

  // Map pour les gagnants de chaque round (section → player name)
  const winnersByRound = new Map<string, string>();
  for (const r of rows) {
    const roundCols: [DrawRound, string | null][] = [
      ["R128", r.round_r128], ["R64", r.round_r64], ["R32", r.round_r32],
      ["R16", r.round_r16], ["QF", r.round_qf], ["SF", r.round_sf], ["F", r.round_f],
    ];
    for (const [round, val] of roundCols) {
      if (val && val !== "BYE") winnersByRound.set(`${round}:${r.section}`, val);
    }
    if (r.round_w) winnersByRound.set(`W:${r.section}`, r.round_w);
  }

  // Construire chaque round
  let matchPos = 0;
  for (const round of ROUND_ORDER) {
    if (round === "W") continue; // Pas de match pour "Champion"
    const numMatches = roundSizes[round];
    if (!numMatches) continue;

    for (let i = 0; i < numMatches; i++) {
      const position = i;
      // Sections des deux joueurs de ce match
      const section1 = i * 2;
      const section2 = i * 2 + 1;

      const p1 = playerBySection.get(section1);
      const p2 = playerBySection.get(section2);

      const player1: DrawMatchPlayer = p1 ? {
        name: p1.player_name,
        seed: p1.player_seed ?? undefined,
        country: p1.player_country ?? undefined,
      } : { name: "BYE" };

      const player2: DrawMatchPlayer = p2 ? {
        name: p2.player_name,
        seed: p2.player_seed ?? undefined,
        country: p2.player_country ?? undefined,
      } : { name: "BYE" };

      // Déterminer le status et le gagnant
      const winnerName = winnersByRound.get(`${round}:${section1}`) ?? winnersByRound.get(`${round}:${section2}`);
      let status: "upcoming" | "live" | "completed" = "upcoming";
      let winner: 1 | 2 | undefined;

      if (winnerName) {
        status = "completed";
        if (winnerName === player1.name) winner = 1;
        else if (winnerName === player2.name) winner = 2;
      }

      matches.push({
        round,
        position,
        player1,
        player2,
        status,
        winner,
      });
      matchPos++;
    }
  }

  return matches;
}

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

    // Vérifie que le slug est connu
    const meta = TOURNAMENT_META[slug];
    if (!meta) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Tournoi inconnu : ${slug}` },
        { status: 404 },
      );
    }

    // Cache check
    const cached = cache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL_MS) &&
      cached.data.slug === slug &&
      cached.data.year === year
    ) {
      return NextResponse.json(cached.data);
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "DB_UNAVAILABLE", message: "Base de données non disponible" },
        { status: 503 },
      );
    }

    try {
      // Slugs US Open qui ont un bracket tnnslive.com
      const hasBracket = slug === "us-open" || slug === "us-open-women";

      const rows = db
        .prepare(
          `SELECT player_name, player_seed, player_qualifier, player_country,
                  player_ta_id, prob_r16, prob_qf, prob_sf, prob_f, prob_win,
                  section, updated_at
           FROM tennis_draw_forecast
           WHERE tournament_slug = ? AND year = ?
           ORDER BY prob_win DESC NULLS LAST`,
        )
        .all(slug, year) as DrawRow[];

      // Bracket tnnslive (si dispo)
      let bracketRows: BracketRow[] = [];
      let matches: DrawMatch[] = [];
      if (hasBracket) {
        const bracketSlug = slug === "us-open" ? "us-open-men" : "us-open-women";
        bracketRows = db
          .prepare(
            `SELECT section, player_name, player_seed, player_country,
                    qualifier, wildcard, round_r128, round_r64, round_r32,
                    round_r16, round_qf, round_sf, round_f, round_w, updated_at
             FROM tennis_draw_bracket
             WHERE tournament_slug = ? AND year = ?
             ORDER BY section ASC`,
          )
          .all(bracketSlug, year) as BracketRow[];

        if (bracketRows.length > 0) {
          matches = buildBracketFromRows(bracketRows);
        }
      }

      // Si ni forecast ni bracket → 404
      if (rows.length === 0 && bracketRows.length === 0) {
        return NextResponse.json(
          { error: "NO_DATA", message: `Aucune donnée pour ${slug} ${year}` },
          { status: 404 },
        );
      }

      // Date de dernière mise à jour (la plus récente)
      const updatedAt = rows[0]?.updated_at ?? bracketRows[0]?.updated_at ?? new Date().toISOString();

      // Taille du tableau (basée sur la catégorie, ou calculée depuis les sections)
      const maxSection = rows.length > 0
        ? Math.max(...rows.map((r) => r.section))
        : bracketRows.length > 0
          ? Math.max(...bracketRows.map((r) => r.section))
          : 0;
      const drawSize = DRAW_SIZE_BY_CATEGORY[meta.category] ?? (maxSection + 1) * 8;

      const data: TournamentDraw = {
        slug,
        name: meta.name,
        year,
        surface: meta.surface,
        category: meta.category,
        drawSize,
        source: hasBracket && bracketRows.length > 0 ? "manual" : "tennisabstract",
        updatedAt,
        forecast: rows.map(rowToForecast),
        ...(matches.length > 0 ? { matches } : {}),
      };

      cache.set(data);
      return NextResponse.json(data);
    } finally {
      db.close();
    }
  } catch (err) {
    return apiErrorHandler(err, "tennis/tournament/draw", () =>
      NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Erreur interne" },
        { status: 500 },
      ),
    );
  }
}
