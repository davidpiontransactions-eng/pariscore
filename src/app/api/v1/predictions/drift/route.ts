/**
 * GET /api/v1/predictions/drift — Détection de drift du modèle football.
 *
 * Compare les performances récentes vs une période de référence (baseline)
 * en utilisant les PredictionLog stockées en base.
 *
 * Query params :
 *   - period  : fenêtre récente ("7d" | "30d" | "90d", défaut "7d")
 *   - baseline : fenêtre de référence ("90d" | "180d", défaut "90d")
 *
 * Réponse : { drifted, summary, markets, checkedAt }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectDrift } from "@/lib/prediction/football/drift-detection";

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
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Période récente (défaut 7 jours)
    const periodDays = parseDuration(searchParams.get("period"), 7);
    // Période baseline (défaut 90 jours)
    const baselineDays = parseDuration(searchParams.get("baseline"), 90);

    // Validation
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

    // Fenêtre récente : [now - periodDays, now]
    const recentFrom = new Date(now);
    recentFrom.setDate(recentFrom.getDate() - periodDays);

    // Fenêtre baseline : [now - baselineDays, now - periodDays]
    const baselineFrom = new Date(now);
    baselineFrom.setDate(baselineFrom.getDate() - baselineDays);
    const baselineTo = new Date(recentFrom);

    // Chargement des logs settleés depuis Prisma
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

    // Pas assez de données
    if (recentLogs.length === 0 || baselineLogs.length === 0) {
      return NextResponse.json({
        drifted: false,
        summary: "Pas assez de données pour détecter le drift",
        markets: [],
        checkedAt: now.toISOString(),
        details: {
          recentCount: recentLogs.length,
          baselineCount: baselineLogs.length,
        },
      });
    }

    // Détection de drift
    const result = detectDrift(recentLogs, baselineLogs);

    return NextResponse.json({
      drifted: result.drifted,
      summary: result.summary,
      markets: result.metrics,
      checkedAt: now.toISOString(),
      details: {
        recentCount: recentLogs.length,
        baselineCount: baselineLogs.length,
        period: `${periodDays}d`,
        baseline: `${baselineDays}d`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/drift]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
