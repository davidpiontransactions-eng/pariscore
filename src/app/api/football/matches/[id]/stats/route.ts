import { NextResponse } from "next/server";
import type { MatchEvent, MatchTimelineData, TimelineTotals } from "@/lib/football-timeline";
import {
  buildPressureTimeline,
  type PressureBucketInput,
} from "@/lib/football-pressure-index";
import { fetchBSDMatchStats, fetchBSDFootballMatchMeta } from "@/lib/bsd-football-fetcher";
import { resolveESPNEvent, fetchESPNTimeline } from "@/lib/espn-soccer-fetcher";

/**
 * GET /api/football/matches/[id]/stats
 *
 * Assemble la timeline momentum/pression d'un match :
 *   1. BSD /v2/events/{id}/stats/  → anchor momentum + xG/min + buts (payant, déjà intégré)
 *   2. ESPN public (gratuit)       → commentary/corners/tirs minute-par-minute + totaux
 *   3. Moteur Pressure Index       → buckets 5min normalisés [-100,+100], reconcile BSD
 *
 * Cache par-match TTL 60 s (Map sur globalThis — multi-worker safe). Chaque source est
 * best-effort : une panne ESPN retombe sur BSD seul, et vice-versa. 503 → indisponible total.
 */
const CACHE_TTL = 60_000;

type CachedStats = { data: MatchTimelineData; at: number };
const g = globalThis as unknown as { __footballStatsCacheV2?: Map<string, CachedStats> };
const cache: Map<string, CachedStats> = g.__footballStatsCacheV2 ?? new Map();
if (!g.__footballStatsCacheV2) g.__footballStatsCacheV2 = cache;

/** Fusionne le xG/minute BSD dans les buckets (par plage de 5'). Construit les buckets si absents. */
function mergeXgBuckets(buckets: PressureBucketInput[], xgPerMinute: { minute: number; home: number; away: number }[]): PressureBucketInput[] {
  const pts = (Array.isArray(xgPerMinute) ? xgPerMinute : []).filter(
    (p) => p && Number.isFinite(Number(p?.minute)),
  );
  const merged = buckets.length
    ? buckets.map((b) => ({ ...b, xg: { home: (b.xg?.home ?? 0), away: (b.xg?.away ?? 0) } }))
    : pts.map((p) => ({ start: Math.floor(Number(p.minute) / 5) * 5, danger: { home: 0, away: 0 }, xg: { home: 0, away: 0 } }));
  if (!pts.length) return merged;
  for (const pt of pts) {
    const minute = Number(pt.minute);
    const start = Math.floor(minute / 5) * 5;
    let target = merged.find((b) => b.start === start);
    if (!target) {
      target = { start, danger: { home: 0, away: 0 }, xg: { home: 0, away: 0 } };
      merged.push(target);
      merged.sort((a, b) => a.start - b.start);
    }
    if (!target.xg) target.xg = { home: 0, away: 0 };
    target.xg.home += Number(pt.home) || 0;
    target.xg.away += Number(pt.away) || 0;
  }
  return merged;
}

/** BSD goals → MatchEvent[] (sans buteur, xG absent côté BSD events). */
function bsdGoalsAsEvents(goals: { minute: number; home: boolean; type: string }[]): MatchEvent[] {
  return (Array.isArray(goals) ? goals : [])
    .filter((g) => g && Number.isFinite(Number(g.minute)) && typeof g.home === "boolean")
    .map((g) => ({
      minute: Number(g.minute),
      kind: "goal" as const,
      side: g.home ? "home" as const : "away" as const,
      scorer: null,
      teamName: null,
      xg: null,
      score: null,
      goalType: g.type === "own" ? "own" as const : g.type === "penalty" ? "penalty" as const : "regular" as const,
    }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const matchId = rawId.replace(/^bsd-/, "");

  const hit = cache.get(matchId);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json({ ...hit.data, updatedAt: hit.data.updatedAt });
  }

  try {
    // 1) BSD — anchor momentum + xG/min + buts (best-effort).
    let bsd: Awaited<ReturnType<typeof fetchBSDMatchStats>> | null = null;
    try {
      bsd = await fetchBSDMatchStats(matchId);
    } catch (e) {
      console.warn(`[football-stats] BSD stats failed ${matchId}:`, (e as Error).message);
    }

    // 2) Meta (noms, date, ligue) → résolution ESPN.
    const meta = await fetchBSDFootballMatchMeta(matchId);

    // 3) ESPN public — buckets minute-par-minute + totaux + buts/buteurs.
    let espn: Awaited<ReturnType<typeof fetchESPNTimeline>> | null = null;
    let finalMinute: number | undefined;
    if (meta) {
      try {
        const resolved = await resolveESPNEvent({
          homeTeam: meta.homeTeam,
          awayTeam: meta.awayTeam,
          date: meta.date,
          leagueId: meta.leagueId,
        });
        if (resolved) espn = await fetchESPNTimeline(resolved);
      } catch (e) {
        console.warn(`[football-stats] ESPN failed ${matchId}:`, (e as Error).message);
      }
      if (meta.isLive && meta.currentMinute != null) finalMinute = meta.currentMinute;
    }

    let buckets: PressureBucketInput[] = [];
    let events: MatchEvent[] = [];
    let totals: TimelineTotals | undefined;
    let source: MatchTimelineData["source"] = "bsd";

    if (espn) {
      buckets = mergeXgBuckets(espn.buckets, bsd?.xgPerMinute ?? []);
      events = espn.events;
      totals = espn.totals;
      source = bsd ? "bsd+espn" : "espn";
    } else if (bsd) {
      // BSD seul : buckets depuis xG/minute, événements buts BSD.
      buckets = mergeXgBuckets([], bsd.xgPerMinute);
      events = bsdGoalsAsEvents(bsd.goals);
      source = "bsd";
    }

    if (!bsd && !espn) throw new Error("aucune source de stats");
    if (!buckets.length && !events.length && !espn) throw new Error("données par-minute absentes");

    const data = buildPressureTimeline({
      buckets,
      events,
      bsdMomentum: bsd?.momentum ?? undefined,
      totals,
      source,
      finalMinute,
    });
    const stamped: MatchTimelineData & { updatedAt: string } = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    cache.set(matchId, { data: stamped, at: Date.now() });
    return NextResponse.json(stamped);
  } catch (err) {
    console.error(`[football-stats] failed for ${matchId}:`, (err as Error).message);
    return NextResponse.json(
      { error: "football match stats unavailable" },
      { status: 503 },
    );
  }
}