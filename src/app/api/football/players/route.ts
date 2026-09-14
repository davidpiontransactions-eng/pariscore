import { NextResponse } from "next/server";
import { BSD_LEAGUE_IDS } from "@/lib/league-mapping";
import { understatPlayers, type UnderstatPlayer as UnderstatPlayerData } from "@/lib/football-understat-players";
import { fbrefPlayerStats, type FbrefStatType } from "@/lib/football-fbref-stats";
import { resolveLeagueIds } from "@/lib/league-id-bridge";

const CACHE_TTL = 6 * 60 * 60_000;

export type PlayerRow = {
  name: string;
  team: string;
  games: number;
  total: number;
  perMatch: number;
  /** Photo joueur BSD Image API (cut-out si dispo) — absente en fallback Understat. */
  photo?: string;
  /** Enrichissements FBref/Understat */
  xG?: number | null;
  xAG?: number | null;
  npxG?: number | null;
  shots?: number | null;
  keyPasses?: number | null;
  touches?: number | null;
  tackles?: number | null;
};

export type PlayersPayload = {
  league: string;
  seasonYear: number;
  source: "bsd" | "understat";
  scorers: PlayerRow[];
  assisters: PlayerRow[];
};

/** Cache multi-clés (league:seasonYear:top) — les stats joueurs sont lentes. */
const cache = new Map<string, { payload: PlayersPayload; at: number }>();

/** slug PariScore → slug Understat (fallback si BSD indisponible). */
const UNDERSTAT_LEAGUES: Record<string, string> = {
  epl: "EPL",
  laliga: "La_liga",
  bundesliga: "Bundesliga",
  seriea: "Serie_A",
  ligue1: "Ligue_1",
  russian_premier: "RFPL",
};

type BsdSeason = { id: number; year: number; is_current?: boolean };

async function bsdGet<T>(path: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_KEY_MISSING");
  const res = await fetch(`https://sports.bzzoiro.com/api${path}`, {
    headers: { Authorization: `Token ${key}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`BSD_HTTP_${res.status}`);
  return (await res.json()) as T;
}

function resolveSeasonId(
  seasons: BsdSeason[],
  seasonParam: string | null,
): number {
  if (seasonParam) {
    const y = parseInt(seasonParam.slice(0, 4), 10);
    const hit = seasons.find((s) => s.year === y);
    if (hit) return hit.id;
  }
  const current = seasons.find((s) => s.is_current);
  if (current) return current.id;
  if (seasons.length > 0) return seasons[0].id;
  throw new Error("SEASON_NOT_FOUND");
}

type BsdLeaderRow = {
  rank?: number;
  player_id?: number;
  player_name?: string;
  team_name?: string;
  value?: number | string;
  matches?: number | string;
};

function mapLeaders(leaders: BsdLeaderRow[] | undefined, top: number): PlayerRow[] {
  return (leaders ?? [])
    .slice(0, top)
    .map((l) => {
      const games = Number(l.matches) || 0;
      const total = Number(l.value) || 0;
      return {
        name: String(l.player_name ?? "").trim(),
        team: String(l.team_name ?? "").trim(),
        games,
        total,
        perMatch: games > 0 ? Math.round((total / games) * 100) / 100 : 0,
        photo: l.player_id
          ? `https://sports.bzzoiro.com/img/player/${l.player_id}/?sor=true`
          : undefined,
      };
    })
    .filter((r) => r.name && r.games > 0);
}

async function fetchBsdPlayers(
  league: string,
  seasonParam: string | null,
  top: number,
): Promise<PlayersPayload> {
  const leagueId = BSD_LEAGUE_IDS[league];
  if (!leagueId) throw new Error("UNSUPPORTED_LEAGUE");

  const { seasons } = await bsdGet<{ seasons: BsdSeason[] }>(
    `/v2/leagues/${leagueId}/seasons/`,
  );
  const seasonYear = parseInt((seasonParam ?? "").slice(0, 4), 10) || NaN;
  const seasonId = resolveSeasonId(seasons, seasonParam);

  const [scorersRes, assistersRes] = await Promise.all([
    bsdGet<{ leaders?: BsdLeaderRow[]; season?: BsdSeason }>(
      `/v2/leagues/${leagueId}/top/scorers/?limit=${top}&season_id=${seasonId}`,
    ),
    bsdGet<{ leaders?: BsdLeaderRow[] }>(
      `/v2/leagues/${leagueId}/top/assists/?limit=${top}&season_id=${seasonId}`,
    ),
  ]);

  return {
    league,
    seasonYear: Number.isFinite(seasonYear) ? seasonYear : (scorersRes.season?.year ?? NaN),
    source: "bsd",
    scorers: mapLeaders(scorersRes.leaders, top),
    assisters: mapLeaders(assistersRes.leaders, top),
  };
}

/* ---------------------------- Fallback Understat --------------------------- */

type UnderstatPlayer = {
  player_name?: string;
  team_title?: string;
  games?: number | string;
  goals?: number | string;
  assists?: number | string;
};

const UNDERSTAT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json, text/javascript, */*; q=0.01",
};

function topBy(
  players: UnderstatPlayer[],
  field: "goals" | "assists",
  top: number,
): PlayerRow[] {
  return players
    .map((p) => {
      const games = Number(p.games) || 0;
      const total = Number(p[field]) || 0;
      return {
        name: String(p.player_name ?? "").trim(),
        team: String(p.team_title ?? "").trim(),
        games,
        total,
        perMatch: games > 0 ? Math.round((total / games) * 100) / 100 : 0,
      };
    })
    .filter((r) => r.name && r.games > 0)
    .sort((a, b) => b.total - a.total || b.perMatch - a.perMatch)
    .slice(0, top);
}

// ── Enrichissement FBref/Understat (T1.3) ──

type EnrichIndex = {
  understat: Map<string, UnderstatPlayerData>;
  fbrefShots: Map<string, number>;
  fbrefPassing: Map<string, { keyPasses: number; touches: number }>;
  fbrefDefense: Map<string, { tackles: number }>;
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEnrichIndex(league: string, seasonYear: number): EnrichIndex {
  const ids = resolveLeagueIds(league);
  const idx: EnrichIndex = {
    understat: new Map(),
    fbrefShots: new Map(),
    fbrefPassing: new Map(),
    fbrefDefense: new Map(),
  };

  // Understat players
  if (ids?.hasUnderstat) {
    const up = understatPlayers(ids.slug);
    if (up) {
      for (const p of up) {
        if (p.player_name) idx.understat.set(normalizeName(p.player_name), p);
      }
    }
  }

  // FBref player stats
  const fbrefSeason = `${seasonYear}-${seasonYear + 1}`;
  if (ids?.hasFbref) {
    try {
      const passing = fbrefPlayerStats(ids.slug, fbrefSeason, "passing");
      if (passing) {
        for (const r of passing) {
          const name = normalizeName(String(r["Player"] ?? ""));
          if (name) {
            idx.fbrefPassing.set(name, {
              keyPasses: Number(r["Key Passes"]) || 0,
              touches: Number(r["Touches"]) || 0,
            });
          }
        }
      }
    } catch { /* pas encore scrapé */ }
    try {
      const defense = fbrefPlayerStats(ids.slug, fbrefSeason, "defense");
      if (defense) {
        for (const r of defense) {
          const name = normalizeName(String(r["Player"] ?? ""));
          if (name) {
            idx.fbrefDefense.set(name, {
              tackles: Number(r["Tkl"]) || 0,
            });
          }
        }
      }
    } catch { /* pas encore scrapé */ }
  }

  return idx;
}

function enrichRow(row: PlayerRow, idx: EnrichIndex): PlayerRow {
  const n = normalizeName(row.name);
  const up = idx.understat.get(n);
  const fp = idx.fbrefPassing.get(n);
  const fd = idx.fbrefDefense.get(n);
  return {
    ...row,
    xG: up?.xG ?? null,
    xAG: up?.xAG ?? null,
    npxG: up?.npxG ?? null,
    shots: up?.shots ?? null,
    keyPasses: fp?.keyPasses ?? up?.key_passes ?? null,
    touches: fp?.touches ?? null,
    tackles: fd?.tackles ?? null,
  };
}

async function enrichPlayersWithFbrefUnderstat(
  league: string,
  seasonYear: number,
): Promise<PlayersPayload | null> {
  const idx = buildEnrichIndex(league, seasonYear);
  const hasAny = idx.understat.size > 0 || idx.fbrefPassing.size > 0 || idx.fbrefDefense.size;
  if (!hasAny) return null;

  // Construire les listes scorers/assisters depuis Understat index
  const allPlayers = [...idx.understat.values()];
  if (allPlayers.length === 0) return null;

  const scorers: PlayerRow[] = allPlayers
    .map((p) => enrichRow({
      name: p.player_name ?? "",
      team: p.team_title ?? "",
      games: p.apps ?? 0,
      total: p.goals ?? 0,
      perMatch: (p.apps ?? 0) > 0 ? Math.round(((p.goals ?? 0) / (p.apps ?? 1)) * 100) / 100 : 0,
    }, idx))
    .filter((r) => r.name && r.games > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const assisters: PlayerRow[] = allPlayers
    .map((p) => enrichRow({
      name: p.player_name ?? "",
      team: p.team_title ?? "",
      games: p.apps ?? 0,
      total: p.assists ?? 0,
      perMatch: (p.apps ?? 0) > 0 ? Math.round(((p.assists ?? 0) / (p.apps ?? 1)) * 100) / 100 : 0,
    }, idx))
    .filter((r) => r.name && r.games > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    league,
    seasonYear,
    source: "understat",
    scorers,
    assisters,
  };
}

async function fetchUnderstatPlayers(
  league: string,
  seasonYear: number,
  top: number,
): Promise<PlayersPayload> {
  const understatSlug = UNDERSTAT_LEAGUES[league];
  if (!understatSlug) throw new Error("UNSUPPORTED_LEAGUE");

  const res = await fetch(
    `https://understat.com/getLeagueData/${understatSlug}/${seasonYear}`,
    { headers: UNDERSTAT_HEADERS, signal: AbortSignal.timeout(20000) },
  );
  if (!res.ok) throw new Error(`UNDERSTAT_HTTP_${res.status}`);
  const payload = (await res.json()) as { players?: UnderstatPlayer[] };
  const players = payload.players ?? [];
  if (players.length === 0) throw new Error("UNDERSTAT_PLAYERS_EMPTY");

  return {
    league,
    seasonYear,
    source: "understat",
    scorers: topBy(players, "goals", top),
    assisters: topBy(players, "assists", top),
  };
}

/**
 * GET /api/football/players?league=ligue1&season=2026/27&top=10
 *
 * Meilleurs buteurs & passeurs décisifs du championnat, moyenne par match.
 * Source prioritaire : BSD leaderboards (`/v2/leagues/{id}/top/scorers|assists`)
 * + photos Image API. Fallback : Understat getLeagueData (6 ligues).
 * Cache serveur 6 h (stats joueurs = lentes).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league") ?? "";
  const seasonParam = url.searchParams.get("season");
  const seasonYear = parseInt((seasonParam ?? "").slice(0, 4), 10);
  const top = Math.min(Math.max(parseInt(url.searchParams.get("top") ?? "10", 10) || 10, 1), 20);

  const key = `${league}:${seasonParam}:${top}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.payload);
  }

  const errors: string[] = [];

  // 1) BSD — toutes les ligues classements + photos.
  if (BSD_LEAGUE_IDS[league] && process.env.BSD_API_KEY) {
    try {
      const payload = await fetchBsdPlayers(league, seasonParam, top);
      cache.set(key, { payload, at: Date.now() });
      return NextResponse.json(payload);
    } catch (e) {
      errors.push(`bsd:${(e as Error).message}`);
    }
  }

  // 2) Fallback Understat (6 ligues, sans photos).
  if (UNDERSTAT_LEAGUES[league] && Number.isFinite(seasonYear)) {
    try {
      const payload = await fetchUnderstatPlayers(league, seasonYear, top);
      cache.set(key, { payload, at: Date.now() });
      return NextResponse.json(payload);
    } catch (e) {
      errors.push(`understat:${(e as Error).message}`);
    }
  }

  // 3) Enrichissement FBref/Understat player stats (shots, xG, touches, etc.)
  //    Merge par nom d'équipe + nom de joueur (fuzzy match).
  const ids = resolveLeagueIds(league);
  if (ids) {
    try {
      const enrichPayload = await enrichPlayersWithFbrefUnderstat(league, seasonYear);
      if (enrichPayload) {
        cache.set(key, { payload: enrichPayload, at: Date.now() });
        return NextResponse.json(enrichPayload);
      }
    } catch (e) {
      errors.push(`enrich:${(e as Error).message}`);
    }
  }

  if (!BSD_LEAGUE_IDS[league] && !UNDERSTAT_LEAGUES[league]) {
    return NextResponse.json(
      {
        error: "UNSUPPORTED_LEAGUE",
        message: `Joueurs indisponibles pour « ${league} ».`,
        detail: errors.join(" | "),
      },
      { status: 404 },
    );
  }
  if (cached) return NextResponse.json(cached.payload, { headers: { "x-cache": "stale" } });
  return NextResponse.json({ error: "PLAYERS_UNAVAILABLE", detail: errors.join(" | ") }, { status: 502 });
}
