import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { FunnelSnapshot, FunnelRuleId } from "@/lib/football-live-thresholds";

/**
 * POST /api/football/live-funnel-log
 *
 * Backtest des seuils du funnel (P3 INNOVATIONS-2026-09-09) : le popup live
 * envoie 1 snapshot/min (FunnelSnapshot) → KvStore `funnellog:{matchId}:{minute}`.
 * L'index `funnellog:index` (JSON ordonné) borne le volume à 1500 snapshots.
 * Comparer ensuite `markets` vs score final → calibration des seuils.
 *
 * Durcissement H3 (AUDIT-2026-09-09) : `signals` validés contre le vocabulaire,
 * marchés clampés 0-100, rate-limit 1/30 s par (IP, match).
 */
const INDEX_KEY = "funnellog:index";
const MAX_SNAPS = 1500;
const RATE_MS = 30_000;

const FUNNEL_RULE_IDS: ReadonlySet<string> = new Set([
  "homePressure", "pressureDiff", "awayPossession", "totalSot", "homeShots",
  "awaySot", "totalCorners", "homeCorners", "yellowCards", "dangerousAttacks",
  "homeAttacks", "xgTotal",
]);

const g = globalThis as unknown as { __funnelLogRate?: Map<string, number> };
function rateLimited(ip: string, matchId: string): boolean {
  if (!g.__funnelLogRate) g.__funnelLogRate = new Map();
  const map = g.__funnelLogRate;
  const now = Date.now();
  // Évite la croissance : purge opportuniste des entrées expirées.
  if (map.size > 2000) {
    for (const [k, t] of map) if (now - t > RATE_MS) map.delete(k);
  }
  const key = `${ip}|${matchId}`;
  const last = map.get(key);
  if (last != null && now - last < RATE_MS) return true;
  map.set(key, now);
  return false;
}

const clamp100 = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

function snapKey(s: FunnelSnapshot): string {
  const safeId = String(s.matchId || "unknown").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
  return `funnellog:${safeId}:${Math.max(0, Math.min(130, Math.round(s.minute || 0)))}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<FunnelSnapshot>;
    if (!body || typeof body.matchId !== "string" || !body.matchId) {
      return NextResponse.json({ error: "matchId requis" }, { status: 400 });
    }
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip, body.matchId)) {
      return NextResponse.json({ error: "trop de requêtes" }, { status: 429 });
    }
    const rawSignals = Array.isArray(body.signals) ? body.signals : [];
    const signals = rawSignals.filter(
      (s): s is FunnelRuleId => typeof s === "string" && FUNNEL_RULE_IDS.has(s),
    );
    const snap: FunnelSnapshot = {
      matchId: body.matchId.slice(0, 80),
      minute: Math.max(0, Math.min(130, Math.round(Number(body.minute) || 0))),
      homeScore: Math.max(0, Math.min(20, Math.floor(Number(body.homeScore) || 0))),
      awayScore: Math.max(0, Math.min(20, Math.floor(Number(body.awayScore) || 0))),
      source: body.source === "xg" ? "xg" : "prematch",
      signals,
      markets: {
        homeWin: clamp100(body.markets?.homeWin),
        draw: clamp100(body.markets?.draw),
        awayWin: clamp100(body.markets?.awayWin),
        over25: clamp100(body.markets?.over25),
        btts: clamp100(body.markets?.btts),
      },
      at: new Date().toISOString(),
    };
    const key = snapKey(snap);
    await prisma.kvStore.upsert({
      where: { key },
      update: { value: JSON.stringify(snap) },
      create: { key, value: JSON.stringify(snap) },
    });
    // Index borné : évince les plus anciens au-delà de MAX_SNAPS.
    try {
      const idxRow = await prisma.kvStore.findUnique({ where: { key: INDEX_KEY } });
      const idx: string[] = idxRow ? (JSON.parse(idxRow.value) as string[]) : [];
      const next = [...idx.filter((k) => k !== key), key];
      const evicted = next.length > MAX_SNAPS ? next.slice(0, next.length - MAX_SNAPS) : [];
      if (evicted.length) {
        await prisma.kvStore.deleteMany({ where: { key: { in: evicted } } });
      }
      const trimmed = next.slice(-MAX_SNAPS);
      await prisma.kvStore.upsert({
        where: { key: INDEX_KEY },
        update: { value: JSON.stringify(trimmed) },
        create: { key: INDEX_KEY, value: JSON.stringify(trimmed) },
      });
    } catch {
      /* index best-effort — le snapshot est déjà persisté */
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "snapshot invalide" }, { status: 400 });
  }
}
