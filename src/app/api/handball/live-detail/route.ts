import { NextRequest, NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import type { LiveEvent, LiveFeed, TeamStat } from "@/lib/handball-live-commentary";

// Détail live handball (bead xx78) — agrège API-Sports v3 handball :
// /fixtures/events + /fixtures/statistics + /fixtures/players pour une fixture.
//
// Sans API_FOOTBALL_KEY (dev local) → { available: false } : l'UI affiche
// « détail indisponible », JAMAIS d'événements fabricés.
// Cache 30 s (live), TTL aligné sur /api/handball/live.

const BASE = "https://v3.handball.api-sports.io";
const TTL = 30_000;
const TIMEOUT = 8_000;

type Payload = {
  available: boolean;
  fixtureId?: number;
  events?: LiveEvent[];
  homeStats?: TeamStat[];
  awayStats?: TeamStat[];
  homeScorers?: { name: string; goals: number }[];
  awayScorers?: { name: string; goals: number }[];
  updatedAt?: string;
};

const cache = createTtlCache<Payload>("__handballLiveDetailCache");

async function api<T>(path: string, key: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { response?: T };
    return j.response ?? null;
  } catch {
    return null;
  }
}

type RawEvent = {
  time?: { elapsed?: number };
  team?: { id?: number };
  player?: { name?: string };
  type?: string;
  detail?: string;
  comments?: string;
};

type RawStatBlock = {
  team?: { id?: number };
  statistics?: { type?: string; value?: string | number | null }[];
};

type RawPlayersBlock = {
  team?: { id?: number };
  players?: { player?: { name?: string }; statistics?: { goals?: number }[] }[];
};

export async function GET(req: NextRequest) {
  const key = process.env.API_FOOTBALL_KEY;
  const fixtureId = Number(new URL(req.url).searchParams.get("fixture"));
  if (!key || !Number.isFinite(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ available: false } satisfies Payload);
  }

  const cached = cache.getEntry();
  if (cached && isFresh(cached, TTL)) return NextResponse.json(cached.data);

  const [fx, ev, st, pl] = await Promise.all([
    api<{ teams?: { home?: { id?: number }; away?: { id?: number } } }[]>(
      `/fixtures?ids=${fixtureId}`,
      key,
    ),
    api<RawEvent[]>(`/fixtures/events?fixture=${fixtureId}`, key),
    api<RawStatBlock[]>(`/fixtures/statistics?fixture=${fixtureId}`, key),
    api<RawPlayersBlock[]>(`/fixtures/players?fixture=${fixtureId}`, key),
  ]);

  // Statut de fixture connu via events/stats → sinon on ne peut pas confirmer
  const anyData = ev != null || st != null || pl != null;
  if (!anyData) {
    const off: Payload = { available: false, fixtureId };
    cache.set(off);
    return NextResponse.json(off);
  }

  const homeId = fx?.[0]?.teams?.home?.id ?? null;
  const awayId = fx?.[0]?.teams?.away?.id ?? null;

  const events: LiveEvent[] = (ev ?? [])
    .map((e) => ({
      minute: e.time?.elapsed ?? 0,
      team: (homeId != null && e.team?.id === homeId ? "home" : "away") as "home" | "away",
      player: e.player?.name,
      type: e.type ?? "",
      detail: e.detail,
      comment: e.comments,
    }))
    .filter((e) => e.minute > 0 && e.type);

  const mapBlock = (teamId: number | null): TeamStat[] => {
    if (teamId == null) return [];
    const b = (st ?? []).find((x) => x.team?.id === teamId);
    return (b?.statistics ?? [])
      .filter((s) => s?.type != null)
      .map((s) => ({ type: String(s.type), value: s.value ?? null }));
  };

  const goalCounts = new Map<string, number>();
  for (const block of pl ?? []) {
    for (const p of block.players ?? []) {
      const n = p.player?.name;
      const g = p.statistics?.[0]?.goals ?? 0;
      if (n && g > 0) goalCounts.set(n, g);
    }
  }
  const scorers = [...goalCounts.entries()]
    .map(([name, goals]) => ({ name, goals }))
    .sort((a, b) => b.goals - a.goals);

  const payload: Payload = {
    available: true,
    fixtureId,
    events,
    homeStats: mapBlock(homeId),
    awayStats: mapBlock(awayId),
    homeScorers: scorers.slice(0, 5),
    awayScorers: scorers.slice(5, 10),
    updatedAt: new Date().toISOString(),
  };
  cache.set(payload);
  return NextResponse.json(payload);
}
