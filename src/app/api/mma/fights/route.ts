import { NextRequest, NextResponse } from "next/server";
import path from "path";

// ─── Cache avec stale-while-revalidate ───────────────────────────────────────
const CACHE_TTL = 5 * 60_000;       // 5 min fresh
const STALE_TTL = 15 * 60_000;      // 15 min max stale (retry after)
type CacheEntry = { data: unknown; at: number; empty: boolean };
let cache: CacheEntry | null = null;

// ─── Lazy CJS require (import alias impossible pour modules legacy) ──────────
let _svc: any = null;
function svc() {
  if (!_svc) {
    _svc = require(path.join(process.cwd(), "services", "mmaService"));
  }
  return _svc;
}

type MmaFightRaw = {
  fighter_a: string;
  fighter_b: string;
  commence_time: string;
  weight_class?: string;
  event_name?: string;
  prob_a?: number;
  prob_b?: number;
  ps_prob_a?: number;
  ps_prob_b?: number;
  best_odds_a?: number;
  best_odds_b?: number;
  ai_odds_a?: number;
  ai_odds_b?: number;
  ev_a_pct?: number;
  ev_b_pct?: number;
  bet_a?: boolean;
  bet_b?: boolean;
  is_title?: boolean;
  stats_a?: unknown;
  stats_b?: unknown;
  [key: string]: unknown;
};

type MmaEventRaw = {
  event_date: string;
  event_name: string;
  fights: MmaFightRaw[];
};

// GET /api/mma/fights?weightClass=Heavyweight&hours=24&hidePast=true
export async function GET(req: NextRequest) {
  const now = Date.now();
  const { searchParams } = new URL(req.url);

  const weightClass = searchParams.get("weightClass");
  const hours = searchParams.get("hours");
  const hidePast = searchParams.get("hidePast") !== "false";

  // ── Cache hit (fresh) ────────────────────────────────────────────────────
  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(applyFilters(cache.data as MmaEventRaw[], { weightClass, hours, hidePast, now }));
  }

  // ── Cache stale → servir + revalidate en background ──────────────────────
  if (cache && now - cache.at < STALE_TTL && cache.data) {
    const response = NextResponse.json(applyFilters(cache.data as MmaEventRaw[], { weightClass, hours, hidePast, now }));
    response.headers.set("X-Cache", "stale");
    response.headers.set("X-Cache-Age", String(Math.round((now - cache.at) / 1000)));
    revalidateCache(now).catch(() => {});
    return response;
  }

  // ── Cache miss → fetch complet ───────────────────────────────────────────
  try {
    const data = await fetchAndEnrich(now);
    cache = data;
    return NextResponse.json(applyFilters(data.data as MmaEventRaw[], { weightClass, hours, hidePast, now }));
  } catch (err) {
    if (cache?.data) {
      return NextResponse.json(
        { ...applyFilters(cache.data as MmaEventRaw[], { weightClass, hours, hidePast, now }), _stale: true },
      );
    }
    return NextResponse.json(
      { error: "Données MMA indisponibles", details: (err as Error).message },
      { status: 503 },
    );
  }
}

// ─── Fetch + enrich fighters (photos) ───────────────────────────────────────
async function fetchAndEnrich(now: number): Promise<CacheEntry> {
  const s = svc();
  const fights: MmaEventRaw[] = await s.getMMAFights(process.env.ODDS_API_KEY);

  const enriched = await Promise.all(
    fights.map(async (ev) => {
      const enrichedFights = await Promise.all(
        ev.fights.map(async (f: MmaFightRaw) => {
          const [photoA, photoB] = await Promise.all([
            s.getFighterPhoto(f.fighter_a).catch(() => null),
            s.getFighterPhoto(f.fighter_b).catch(() => null),
          ]);
          return { ...f, photo_a: photoA, photo_b: photoB };
        }),
      );
      return { ...ev, fights: enrichedFights };
    }),
  );

  const hasFights = enriched.some((ev) => ev.fights.length > 0);
  return { data: enriched, at: now, empty: !hasFights };
}

// ─── Background revalidation ────────────────────────────────────────────────
async function revalidateCache(now: number) {
  try {
    const data = await fetchAndEnrich(now);
    cache = data;
  } catch {
    // Silencieux — on garde le stale cache
  }
}

// ─── Filtres query params ───────────────────────────────────────────────────
type FilterOpts = {
  weightClass: string | null;
  hours: string | null;
  hidePast: boolean;
  now: number;
};

function applyFilters(events: MmaEventRaw[], opts: FilterOpts): MmaEventRaw[] {
  let result = events;

  if (opts.weightClass) {
    const norm = opts.weightClass.toLowerCase().replace(/\s+/g, "_");
    result = result
      .map((ev) => ({
        ...ev,
        fights: ev.fights.filter(
          (f) => f.weight_class?.toLowerCase().replace(/\s+/g, "_") === norm,
        ),
      }))
      .filter((ev) => ev.fights.length > 0);
  }

  if (opts.hidePast) {
    result = result
      .map((ev) => ({
        ...ev,
        fights: ev.fights.filter((f) => {
          const ts = f.commence_time ? new Date(f.commence_time).getTime() : null;
          return ts && ts > opts.now;
        }),
      }))
      .filter((ev) => ev.fights.length > 0);
  }

  if (opts.hours) {
    const h = parseInt(opts.hours, 10);
    if (Number.isFinite(h) && h > 0) {
      const cutoff = opts.now + h * 3600_000;
      result = result
        .map((ev) => ({
          ...ev,
          fights: ev.fights.filter((f) => {
            const ts = f.commence_time ? new Date(f.commence_time).getTime() : null;
            return ts && ts <= cutoff;
          }),
        }))
        .filter((ev) => ev.fights.length > 0);
    }
  }

  return result;
}
