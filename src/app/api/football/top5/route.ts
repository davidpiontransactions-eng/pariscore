import { NextRequest, NextResponse } from "next/server";
import { computeStrategyTop5Matches, type StrategyTop5 } from "@/lib/football-strategy-top5";
import { emptyStrategyTop5, readFixturesCache, writeFixturesCache } from "@/lib/football-top5-cache";
import { bsdFetch } from "@/lib/bsd-football-fetcher";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";

const CACHE_TTL = 10 * 60_000;

/**
 * Profondeur d'historique servant à construire la forme L5 (store `finished`).
 * BSD `/matches/?status=finished` SANS `date_from/date_to` ne renvoie que les
 * matchs terminés du jour (3 fixtures observées) → store quasi vide → toutes
 * les stratégies basculent sur le repli « cotes » et `gagnant` (qui exige la
 * forme) sort vide. 21 jours ≈ 1 400 matchs = 1 seule requête (limit 2000).
 */
const FORM_HISTORY_DAYS = 21;

const KICKOFF_WINDOWS = ["jour", "48h", "semaine", "1h", "2h", "4h", "8h"] as const;

type CachePayload = StrategyTop5;

const cacheByKey = new Map<string, { at: number; data: CachePayload }>();

/** Matchs terminés de la fenêtre d'historique (borne haute = aujourd'hui inclus). */
function finishedEndpoint(): string {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - FORM_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  return `/matches/?status=finished&date_from=${from}&date_to=${to}&limit=2000`;
}

/**
 * GET /api/football/top5
 *
 * Top 5 MATCHS à venir par stratégie de pari — agrégé sur toutes les ligues BSD.
 * `win` (Jour / 48 h / Sem. / ≤Nh) restreint le classement À LA FENÊTRE : le
 * top-N doit être calculé dans la fenêtre, sinon le filtre client la vide.
 * Cache serveur 10 min.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 5, 1), 20);
  const league = sp.get("league") ?? undefined;
  const rawWin = sp.get("win") ?? "";
  const win = (KICKOFF_WINDOWS as readonly string[]).includes(rawWin)
    ? (rawWin as (typeof KICKOFF_WINDOWS)[number])
    : undefined;
  const cacheKey = `${limit}|${league ?? "all"}|${win ?? "all"}`;

  const cached = cacheByKey.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({
      ...cached.data,
      meta: { source: "cache", computedAt: new Date(cached.at).toISOString() },
    });
  }

  try {
    const [finished, fixtures] = await Promise.all([
      bsdFetch<BSDFootballMatch[]>(finishedEndpoint()),
      bsdFetch<BSDFootballMatch[]>(
        "/matches/?status=notstarted&limit=1000",
      ),
    ]);

    const data: StrategyTop5 = computeStrategyTop5Matches(finished, fixtures, { limit, league, window: win });
    cacheByKey.set(cacheKey, { at: Date.now(), data });
    writeFixturesCache(finished, fixtures);

    return NextResponse.json({
      ...data,
      meta: { source: "bsd", computedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[football-top5] fetch failed:", (err as Error).message);
    // Fallback 1 : re-scorer le dernier snapshot disque (TTL 6h).
    const snap = readFixturesCache();
    if (snap) {
      const replayed = computeStrategyTop5Matches(snap.finished, snap.fixtures, { limit, league, window: win });
      return NextResponse.json({
        ...replayed,
        meta: { source: "cache-fallback", computedAt: new Date(snap.at).toISOString(), error: (err as Error).message },
      });
    }
    // Fallback 2 : shape vide COMPLÈTE (toutes les stratégies à []).
    return NextResponse.json({
      ...emptyStrategyTop5(),
      matches: [],
      meta: { source: "fallback", computedAt: new Date().toISOString(), error: (err as Error).message },
    }, { status: 200 });
  }
}
