import { NextResponse } from "next/server";
import { BSD_LEAGUE_IDS } from "@/lib/league-mapping";

const CACHE_TTL = 6 * 60 * 60_000;

export type PlayerRow = {
  name: string;
  team: string;
  games: number;
  total: number;
  perMatch: number;
  /** Photo joueur BSD Image API (cut-out si dispo) — absente en fallback Understat. */
  photo?: string;
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
