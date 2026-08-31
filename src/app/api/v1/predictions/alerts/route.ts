/**
 * /api/v1/predictions/alerts — Alertes de drift du modèle football.
 *
 * POST : déclenche manuellement une vérification de drift + alerte.
 * GET  : retourne les alertes récentes (mémoire in-memory).
 *
 * Query params (POST) :
 *   - period   : fenêtre récente ("7d" | "30d", défaut "7d")
 *   - baseline : fenêtre de référence ("90d" | "180d", défaut "90d")
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAndAlert,
  getRecentAlerts,
  getLastChecked,
} from "@/lib/prediction/football/alerting";

// ---------------------------------------------------------------------------
// Parsing des durées
// ---------------------------------------------------------------------------

const DURATION_RE = /^(\d+)(d)$/;

function parseDuration(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const match = DURATION_RE.exec(value);
  if (!match) return fallback;
  return parseInt(match[1], 10);
}

// ---------------------------------------------------------------------------
// GET — Historique des alertes
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const alerts = getRecentAlerts();
    const lastChecked = getLastChecked();

    return NextResponse.json({
      alerts,
      lastChecked: lastChecked ?? null,
      count: alerts.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/alerts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Déclenchement manuel de vérification
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const periodDays = parseDuration(searchParams.get("period"), 7);
    const baselineDays = parseDuration(searchParams.get("baseline"), 90);

    if (periodDays < 1 || periodDays > 365) {
      return NextResponse.json(
        { error: "period doit être entre 1d et 365d" },
        { status: 400 },
      );
    }
    if (baselineDays < 7 || baselineDays > 730) {
      return NextResponse.json(
        { error: "baseline doit être entre 7d et 730d" },
        { status: 400 },
      );
    }

    const now = new Date();

    // Fenêtre récente
    const recentFrom = new Date(now);
    recentFrom.setDate(recentFrom.getDate() - periodDays);

    // Fenêtre baseline
    const baselineFrom = new Date(now);
    baselineFrom.setDate(baselineFrom.getDate() - baselineDays);
    const baselineTo = new Date(recentFrom);

    const [recentLogs, baselineLogs] = await Promise.all([
      prisma.predictionLog.findMany({
        where: {
          settled: true,
          createdAt: { gte: recentFrom },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.predictionLog.findMany({
        where: {
          settled: true,
          createdAt: { gte: baselineFrom, lt: baselineTo },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (recentLogs.length === 0 || baselineLogs.length === 0) {
      return NextResponse.json({
        drift: { drifted: false, metrics: [], summary: "Pas assez de données" },
        alerted: false,
        lastChecked: now.toISOString(),
        details: {
          recentCount: recentLogs.length,
          baselineCount: baselineLogs.length,
        },
      });
    }

    const result = await checkAndAlert(recentLogs, baselineLogs);

    return NextResponse.json({
      drift: {
        drifted: result.drift.drifted,
        metrics: result.drift.metrics,
        summary: result.drift.summary,
      },
      alerted: result.alerted,
      lastChecked: result.lastChecked,
      details: {
        recentCount: recentLogs.length,
        baselineCount: baselineLogs.length,
        period: `${periodDays}d`,
        baseline: `${baselineDays}d`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/alerts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
