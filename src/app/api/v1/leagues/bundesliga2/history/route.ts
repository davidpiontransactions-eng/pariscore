import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createTtlCache, isFresh } from "@/lib/cached-route";

/**
 * GET /api/v1/leagues/bundesliga2/history[?season=2025-2026][&limit=100]
 *
 * DB gratuite 2. Bundesliga (sources : football-data.co.uk + openfootball) :
 *   - football-data.co.uk (D2) : 2023-24 → 2025-26, matchs avec stats (tirs,
 *     corners, cartons) et cotes (b365, pinnacle, moyenne/max clôture, O/U 2.5).
 *   - openfootball/football.json (de.2) : 2020-21 → 2025-26, scores FT + HT.
 * Données persistées par `seed_historique_footballdata.js` et
 * `seed_historique_openfootball.js` (JSON à la racine du repo, meta.slug =
 * "bundesliga2"). Cache serveur 60 min.
 */

type FdMatch = {
  id: string;
  source: string;
  league_id: string;
  league_name: string;
  season: string;
  date: string;
  time?: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  result?: string | null;
  halftime_score?: { home: number | null; away: number | null };
  stats?: Record<string, unknown>;
  odds?: Record<string, unknown>;
};

const FD_FILE = "historique_footballdata.json";
const OF_FILE = "historique_openfootball.json";
const CACHE_TTL_MS = 60 * 60_000;

type HistoryPayload = {
  fd: { leagues: Record<string, { meta: { slug?: string | null; season?: string }; matches: FdMatch[] }> };
  of: { leagues: Record<string, { meta: { slug?: string; season?: string }; matches: FdMatch[] }> };
};
type HistoryCache = HistoryPayload & { fdAts: number; ofAts: number };

const cache = createTtlCache<HistoryCache>("__bl2HistoryCache");

async function loadDB(): Promise<HistoryCache> {
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL_MS)) return cached.data;

  async function readJson<T>(file: string): Promise<T | null> {
    try {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const [fd, of] = await Promise.all([readJson<HistoryPayload["fd"]>(FD_FILE), readJson<HistoryPayload["of"]>(OF_FILE)]);
  const entry: HistoryCache = {
    fd: fd ?? { leagues: {} },
    of: of ?? { leagues: {} },
    fdAts: fd ? Date.now() : 0,
    ofAts: of ? Date.now() : 0,
  };
  cache.set(entry);
  return entry;
}

function seasonStart(season: string): number {
  const y = Number.parseInt(season.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

/** '2025-26' → '2025-2026' (aligner les libellés football-data/openfootball). */
function normalizeSeason(season: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(season);
  if (m) return `${m[1]}-${Number(m[1]) + 1}`;
  return season;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get("season");
  const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100));

  const { fd, of, fdAts, ofAts } = await loadDB();

  // ── Saisons 2. Bundesliga disponibles (fusion des 2 sources) ──
  const seasonRows: {
    season: string;
    source: "football-data.co.uk" | "openfootball";
    count: number;
    withStats: number;
    withOdds: number;
  }[] = [];

  for (const [key, league] of Object.entries(fd.leagues)) {
    if (!key.startsWith("D2_") || !league?.matches) continue;
    if (league.meta?.slug && league.meta.slug !== "bundesliga2") continue;
    const matches = league.matches as FdMatch[];
    seasonRows.push({
      season: league.meta.season ?? key.slice(3),
      source: "football-data.co.uk",
      count: matches.length,
      withStats: matches.filter((m) => m.stats && (m.stats as { shots?: { home?: number } }).shots?.home != null).length,
      withOdds: matches.filter((m) => m.odds && (m.odds as { b365?: unknown }).b365 != null).length,
    });
  }
  for (const [key, league] of Object.entries(of.leagues)) {
    if (!key.startsWith("de.2_") || !league?.matches) continue;
    if (league.meta?.slug && league.meta.slug !== "bundesliga2") continue;
    const s = normalizeSeason(league.meta.season ?? key.slice(5));
    if (seasonRows.some((r) => r.season === s)) continue; // football-data prioritaire
    seasonRows.push({ season: s, source: "openfootball", count: league.matches.length, withStats: 0, withOdds: 0 });
  }
  seasonRows.sort((a, b) => seasonStart(b.season) - seasonStart(a.season));

  // ── Sélection d'une saison ──
  let selected: { season: string; source: "football-data.co.uk" | "openfootball"; matches: FdMatch[] } | null = null;
  if (seasonParam) {
    const normParam = normalizeSeason(seasonParam);
    const fdLeague = Object.entries(fd.leagues).find(([k, l]) => k.startsWith("D2_") && l.meta?.season === normParam);
    if (fdLeague) {
      selected = { season: normParam, source: "football-data.co.uk", matches: fdLeague[1].matches as FdMatch[] };
    } else {
      const ofLeague = Object.entries(of.leagues).find(
        ([k, l]) => k.startsWith("de.2_") && normalizeSeason(l.meta?.season ?? "") === normParam
      );
      if (ofLeague) selected = { season: normParam, source: "openfootball", matches: ofLeague[1].matches as FdMatch[] };
    }
  }

  const matches = (selected?.matches.slice(0, limit).map((m) => ({
    id: m.id,
    date: m.date,
    time: m.time ?? null,
    home: m.home_team,
    away: m.away_team,
    score: { home: m.home_score, away: m.away_score },
    halftime: m.halftime_score ?? null,
    result: m.result ?? null,
    stats: m.stats ?? undefined,
    odds: m.odds ?? undefined,
  })) ?? []);

  return NextResponse.json(
    {
      league: { id: "bundesliga2", name: "2. Bundesliga", country: "Germany", sport: "football" },
      seasons: seasonRows,
      season: selected
        ? { name: selected.season, source: selected.source, count: selected.matches.length, matches }
        : null,
      meta: {
        sources: [
          { id: "football-data.co.uk", div: "D2", loadedAt: new Date(fdAts || 0).toISOString() },
          { id: "openfootball/football.json", div: "de.2", license: "ODbL", loadedAt: new Date(ofAts || 0).toISOString() },
        ],
        cacheTtlSeconds: CACHE_TTL_MS / 1000,
      },
    },
    {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    }
  );
}