import { NextResponse } from "next/server";

const CACHE_TTL = 6 * 60 * 60_000;

export type PlayerRow = {
  name: string;
  team: string;
  games: number;
  total: number;
  perMatch: number;
};

type PlayersPayload = {
  league: string;
  seasonYear: number;
  scorers: PlayerRow[];
  assisters: PlayerRow[];
};

/** Cache multi-clés (league:season:top) — les stats joueurs sont lentes. */
const cache = new Map<string, { payload: PlayersPayload; at: number }>();

/** slug PariScore → slug Understat (ligues couvertes par la source). */
const UNDERSTAT_LEAGUES: Record<string, string> = {
  epl: "EPL",
  laliga: "La_liga",
  bundesliga: "Bundesliga",
  seriea: "Serie_A",
  ligue1: "Ligue_1",
  russian_premier: "RFPL",
};

type UnderstatPlayer = {
  id?: number | string;
  player_name?: string;
  team_title?: string;
  games?: number | string;
  goals?: number | string;
  assists?: number | string;
};

function decodeUnderstatJson(raw: string): string {
  // Les blobs Understat encodent les caractères non-ASCII en \xXX.
  return raw.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

function extractPlayersData(html: string): UnderstatPlayer[] {
  const m = html.match(/var\s+playersData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (!m) return [];
  try {
    return JSON.parse(decodeUnderstatJson(m[1])) as UnderstatPlayer[];
  } catch {
    return [];
  }
}

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

async function fetchPlayers(league: string, seasonYear: number): Promise<PlayersPayload> {
  const understatSlug = UNDERSTAT_LEAGUES[league];
  if (!understatSlug) throw new Error("UNSUPPORTED_LEAGUE");

  const res = await fetch(
    `https://understat.com/league/${understatSlug}/${seasonYear}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PariScore/1.0)" },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) throw new Error(`UNDERSTAT_HTTP_${res.status}`);
  const players = extractPlayersData(await res.text());
  if (players.length === 0) throw new Error("UNDERSTAT_PARSE_EMPTY");

  return {
    league,
    seasonYear,
    scorers: topBy(players, "goals", 10),
    assisters: topBy(players, "assists", 10),
  };
}

/**
 * GET /api/football/players?league=ligue1&season=2025/26&top=10
 *
 * Meilleurs buteurs & passeurs décisifs du championnat (source Understat),
 * avec moyenne par match. Cache serveur 6 h (stats joueurs = lentes).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league") ?? "";
  const seasonParam = url.searchParams.get("season") ?? "2025/26";
  const seasonYear = parseInt(seasonParam.slice(0, 4), 10);
  const top = Math.min(Math.max(parseInt(url.searchParams.get("top") ?? "10", 10) || 10, 1), 20);

  if (!UNDERSTAT_LEAGUES[league]) {
    return NextResponse.json(
      {
        error: "UNSUPPORTED_LEAGUE",
        message: `Joueurs indisponibles pour « ${league} » — source couvre : ${Object.keys(UNDERSTAT_LEAGUES).join(", ")}`,
      },
      { status: 404 },
    );
  }
  if (!Number.isFinite(seasonYear)) {
    return NextResponse.json({ error: "BAD_SEASON" }, { status: 400 });
  }

  const key = `${league}:${seasonYear}:${top}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.payload);
  }

  try {
    const payload = await fetchPlayers(league, seasonYear);
    cache.set(key, { payload, at: Date.now() });
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNSUPPORTED_LEAGUE" ? 404 : 502;
    // Repli cache périmé plutôt qu'une erreur sèche.
    if (cached) return NextResponse.json(cached.payload, { headers: { "x-cache": "stale" } });
    return NextResponse.json({ error: msg }, { status });
  }
}
