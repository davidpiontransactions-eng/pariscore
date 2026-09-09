import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL = 10 * 60_000; // 10 min

function cacheEntry<T>(key: string): T | null {
  const entry = (globalThis as any)[key];
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.data;
  return null;
}
function cacheSet<T>(key: string, data: T) {
  (globalThis as any)[key] = { data, at: Date.now() };
}

async function bsdFetch<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");
  const res = await fetch(`https://sports.bzzoiro.com/api${endpoint}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
  return (await res.json()) as T;
}

type BSDSeason = { id: number; name?: string; year?: number };
type BSDStandingsRow = {
  position?: number; team_id?: number; team_name?: string;
  played?: number; won?: number; drawn?: number; lost?: number;
  gf?: number; ga?: number; gd?: number; pts?: number;
};
type BSDEvent = {
  id?: number; home_team?: string; away_team?: string;
  home_team_obj?: { id?: number; name?: string };
  away_team_obj?: { id?: number; name?: string };
  status?: string; event_date?: string;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leagueIdParam = url.searchParams.get("leagueId"); // ex: "bsd-6" ou "6"
  if (!leagueIdParam) {
    return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  }
  const leagueId = Number(leagueIdParam.replace(/^bsd-/, ""));
  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    return NextResponse.json({ error: "invalid leagueId" }, { status: 400 });
  }

  const cacheKey = `__tableProj_${leagueId}`;
  const cached = cacheEntry<{ teams: unknown[]; fixtures: unknown[] }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // 1) Saison courante
    const seasonRes = await bsdFetch<{ season?: BSDSeason }>(
      `/v2/leagues/${leagueId}/season/`
    );
    const seasonId = seasonRes?.season?.id;
    if (!seasonId) {
      return NextResponse.json({ teams: [], fixtures: [] });
    }

    // 2) Standings officiels
    const official = await bsdFetch<{ standings?: BSDStandingsRow[] }>(
      `/v2/leagues/${leagueId}/standings/?season_id=${seasonId}`
    );
    const teams = (official?.standings ?? [])
      .filter((r) => r.team_name && Number.isFinite(r.pts))
      .map((r) => ({
        id: String(r.team_id),
        name: (r.team_name ?? "").trim(),
        played: Number(r.played) || 0,
        points: Number(r.pts) || 0,
        gf: Number(r.gf) || 0,
        ga: Number(r.ga) || 0,
      }));

    // 3) Matchs restants (scheduled)
    const eventsRes = await bsdFetch<{ results?: BSDEvent[] }>(
      `/events/?league_id=${leagueId}&season_id=${seasonId}&status=scheduled&limit=200`
    );
    const rows = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.results ?? []);
    const fixtures = rows
      .filter((e) => e.home_team_obj?.id && e.away_team_obj?.id)
      .map((e) => ({
        homeId: String(e.home_team_obj!.id),
        awayId: String(e.away_team_obj!.id),
      }));

    const data = { teams, fixtures };
    cacheSet(cacheKey, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[table-projection]", (err as Error).message);
    return NextResponse.json({ teams: [], fixtures: [] });
  }
}
