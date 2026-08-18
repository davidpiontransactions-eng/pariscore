// GET /api/tennis/stats-leaderboard
//
// Leaderboard statistiques joueurs (type ATP Stats Leaderboard) calculé en
// direct depuis `tennis_matches_internal` via src/lib/tennis-stats/leaderboard.
// Si l'agrégation interne est vide (ETL Phase 4.1.1 en attente), repli sur les
// caches officiels ATP/WTA scrapés (src/lib/tennis-stats/official-leaderboard)
// — meta.source + meta.coverage signalent alors la provenance à l'UI.
//
// Query params (tous optionnels) :
//   board=serve      — serve | return | pressure
//   tour=atp         — atp | wta
//   surface=all      — all | hard | clay | grass
//   period=52w       — 52w | ytd | all
//   vsRank=all       — all | top5 | top10 | top20 | top50 | top100
//   minMatches=5     — seuil de matchs (1-50)
//
// Réponse : LeaderboardResult { rows, meta }.
// Conception défensive (alignée sur /api/tennis/player-stats) : cette route
// ne lève JAMAIS de 500 — base absente ou requête KO → 200 avec rows: [] et
// meta.dataUnavailable=true, l'UI affiche l'état vide.

import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError } from "@/lib/api-error";
import {
  getStatsLeaderboard,
  BOARD_TYPES,
  TOUR_FILTERS,
  SURFACE_FILTERS,
  PERIOD_FILTERS,
  VS_RANK_FILTERS,
  DEFAULT_MIN_MATCHES,
  type BoardType,
  type TourFilter,
  type SurfaceFilter,
  type PeriodFilter,
  type VsRankFilter,
  type LeaderboardParams,
  type LeaderboardResult,
} from "@/lib/tennis-stats/leaderboard";
import { getOfficialLeaderboard } from "@/lib/tennis-stats/official-leaderboard";
import { fetchRankings } from "@/lib/bsd-tennis-service";
import { iocToIso2 } from "@/lib/tennis-stats/leaderboard";

const CACHE_TTL_MS = 5 * 60_000; // 5 min — les stats changent lentement
const CACHE_MAX_ENTRIES = 24; // combos de filtres récents (purge FIFO)

const cache = new Map<string, { at: number; payload: LeaderboardResult }>();

function pick<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
  field: string
): T {
  if (raw == null || raw === "") return fallback;
  const v = raw.toLowerCase();
  if ((allowed as readonly string[]).includes(v)) return v as T;
  throw new ValidationError(
    `Invalid '${field}' param — valeurs: ${allowed.join(", ")}`
  );
}

function parseParams(searchParams: URLSearchParams): LeaderboardParams {
  const board = pick(searchParams.get("board"), BOARD_TYPES, "serve" as BoardType, "board");
  const tour = pick(searchParams.get("tour"), TOUR_FILTERS, "atp" as TourFilter, "tour");
  const surface = pick(
    searchParams.get("surface"),
    SURFACE_FILTERS,
    "all" as SurfaceFilter,
    "surface"
  );
  const period = pick(searchParams.get("period"), PERIOD_FILTERS, "52w" as PeriodFilter, "period");
  const vsRank = pick(searchParams.get("vsRank"), VS_RANK_FILTERS, "all" as VsRankFilter, "vsRank");

  let minMatches = DEFAULT_MIN_MATCHES;
  const rawMin = searchParams.get("minMatches");
  if (rawMin != null && rawMin !== "") {
    const n = Number(rawMin);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      throw new ValidationError("Invalid 'minMatches' param — entier 1-50");
    }
    minMatches = n;
  }
  return { board, tour, surface, period, vsRank, minMatches };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseParams(searchParams);

    const cacheKey = JSON.stringify(params);
    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.payload);
    }

    let payload = getStatsLeaderboard(params);

    // Repli officiel ATP/WTA quand l'agrégation interne est vide (base absente
    // en dev, ou stats match-par-match pas encore peuplées par l'ETL).
    if (payload.rows.length === 0) {
      const official = getOfficialLeaderboard(params);
      if (official) {
        payload = {
          rows: official.rows,
          meta: {
            ...params,
            players: official.rows.length,
            generatedAt: official.generatedAt,
            dataUnavailable: false,
            source: official.source,
            coverage: official.coverage,
          },
        };
      }
    }

    // Dernier repli : ranking officiel BSD (points ATP/WTA) quand les caches
    // scrapés sont absents eux aussi — le classement reste toujours frais.
    if (payload.rows.length === 0) {
      try {
        const type = params.tour === "wta" ? "WTA" : "ATP";
        const ranking = await fetchRankings({ type, limit: 200 });
        const rows = (ranking.results ?? ranking).map((r) => ({
          rank: r.position,
          player: r.player.name,
          playerId: null,
          ioc: iocToIso2(r.player.country) ?? r.player.country?.toLowerCase() ?? null,
          matches: null,
          rating: r.points,
          firstServePct: null,
          firstServeWonPct: null,
          secondServeWonPct: null,
          serviceGamesWonPct: null,
          acesPerMatch: null,
          dfsPerMatch: null,
          returnFirstWonPct: null,
          returnSecondWonPct: null,
          returnGamesWonPct: null,
          bpConvertedPct: null,
          bpSavedPct: null,
          tiebreaksWonPct: null,
          decidingSetsWonPct: null,
        }));
        if (rows.length > 0) {
          payload = {
            rows,
            meta: {
              ...params,
              players: rows.length,
              generatedAt: ranking.results?.[0]?.date ?? new Date().toISOString(),
              dataUnavailable: false,
              source: type === "WTA" ? "bsd-wta" : "bsd-atp",
              coverage: { period: "current", surface: "all", vsRank: "all" },
            },
          };
        }
      } catch {
        // BSD KO → on garde l'état vide, l'UI affiche l'état vide sans casser.
      }
    }

    // Purge FIFO simple si trop d'entrées.
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, { at: now, payload });

    return NextResponse.json(payload);
  } catch (err) {
    // Dégradation gracieuse — on ne casse jamais la page stats.
    return apiErrorHandler(err, "tennis/stats-leaderboard", () =>
      NextResponse.json({ rows: [], meta: { dataUnavailable: true } }, { status: 200 })
    );
  }
}
