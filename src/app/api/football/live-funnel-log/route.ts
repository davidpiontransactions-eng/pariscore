import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { FunnelSnapshot } from "@/lib/football-live-thresholds";

/**
 * POST /api/football/live-funnel-log
 *
 * Backtest des seuils du funnel (P3 INNOVATIONS-2026-09-09) : le popup live
 * envoie 1 snapshot/min (FunnelSnapshot) → KvStore `funnellog:{matchId}:{minute}`.
 * L'index `funnellog:index` (JSON ordonné) borne le volume à 1500 snapshots.
 * Comparer ensuite `markets` vs score final → calibration des seuils.
 */
const INDEX_KEY = "funnellog:index";
const MAX_SNAPS = 1500;

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
    const snap: FunnelSnapshot = {
      matchId: body.matchId,
      minute: Math.max(0, Math.min(130, Math.round(Number(body.minute) || 0))),
      homeScore: Math.max(0, Math.floor(Number(body.homeScore) || 0)),
      awayScore: Math.max(0, Math.floor(Number(body.awayScore) || 0)),
      source: body.source === "xg" ? "xg" : "prematch",
      signals: Array.isArray(body.signals) ? body.signals : [],
      markets: {
        homeWin: Number(body.markets?.homeWin) || 0,
        draw: Number(body.markets?.draw) || 0,
        awayWin: Number(body.markets?.awayWin) || 0,
        over25: Number(body.markets?.over25) || 0,
        btts: Number(body.markets?.btts) || 0,
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
