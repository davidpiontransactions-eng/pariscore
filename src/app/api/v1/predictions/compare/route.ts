/**
 * GET /api/v1/predictions/compare — Comparaison A/B de deux versions de modèle.
 *
 * Query params :
 *   - versionA : ID ou nom de la variante A (requis)
 *   - versionB : ID ou nom de la variante B (requis)
 *   - period   : durée d'analyse (défaut "30d") — format : "7d", "30d", "90d"
 *
 * Retourne les métriques Brier/accuracy/log-loss + test chi-deux de significativité.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareVariants } from "@/lib/prediction/football/ab-testing";

// ---------------------------------------------------------------------------
// Parsing de la période
// ---------------------------------------------------------------------------

function parsePeriod(period: string): Date {
  const match = period.match(/^(\d+)([dwm])$/);
  if (!match) {
    throw new Error(`Période invalide : "${period}" — format attendu : "7d", "30w", "3m"`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();

  switch (unit) {
    case "d":
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case "w":
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case "m":
      return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unité inconnue : "${unit}"`);
  }
}

// ---------------------------------------------------------------------------
// Résolution du modelVersionId depuis un nom ou un ID
// ---------------------------------------------------------------------------

async function resolveModelVersionId(identifier: string): Promise<string | null> {
  // Chercher d'abord par ID exact
  const byId = await prisma.modelVersion.findUnique({ where: { id: identifier } });
  if (byId) return byId.id;

  // Sinon chercher par nom
  const byName = await prisma.modelVersion.findFirst({ where: { name: identifier } });
  return byName?.id ?? null;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const versionA = searchParams.get("versionA");
    const versionB = searchParams.get("versionB");
    const period = searchParams.get("period") ?? "30d";

    // Validation
    if (!versionA || !versionB) {
      return NextResponse.json(
        { error: "versionA et versionB sont requis" },
        { status: 400 },
      );
    }

    const since = parsePeriod(period);

    // Résolution des IDs de modèle
    const [modelIdA, modelIdB] = await Promise.all([
      resolveModelVersionId(versionA),
      resolveModelVersionId(versionB),
    ]);

    if (!modelIdA) {
      return NextResponse.json(
        { error: `Modèle introuvable : "${versionA}"` },
        { status: 404 },
      );
    }
    if (!modelIdB) {
      return NextResponse.json(
        { error: `Modèle introuvable : "${versionB}"` },
        { status: 404 },
      );
    }

    // Chargement des PredictionLog pour chaque variante
    const [logsA, logsB] = await Promise.all([
      prisma.predictionLog.findMany({
        where: {
          modelVersionId: modelIdA,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.predictionLog.findMany({
        where: {
          modelVersionId: modelIdB,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Vérifier qu'il y a assez de données
    if (logsA.length === 0 || logsB.length === 0) {
      return NextResponse.json(
        {
          error: "Pas assez de données pour comparer",
          detail: {
            versionA: { count: logsA.length },
            versionB: { count: logsB.length },
          },
        },
        { status: 422 },
      );
    }

    // Comparaison A/B
    const comparison = compareVariants(logsA, logsB);

    return NextResponse.json({
      comparison: {
        winner: comparison.winner,
        confidence: comparison.confidence,
        metricsA: comparison.metricsA,
        metricsB: comparison.metricsB,
        significant: comparison.significant,
      },
      period,
      sampleSize: {
        versionA: logsA.length,
        versionB: logsB.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/compare]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
