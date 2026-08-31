/**
 * GET /api/v1/predictions/health — Tableau de bord santé du système de prédictions.
 *
 * Agrège les informations sur le modèle actif, ses métriques, le drift,
 * le volume de prédictions et l'état du pipeline CatBoost.
 *
 * Réponse : PredictionHealth
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectDrift } from "@/lib/prediction/football/drift-detection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PredictionHealth {
  status: "healthy" | "degraded" | "critical";
  model: {
    active: string;
    totalVersions: number;
    lastTrainedAt: string;
  };
  metrics: {
    brierScore: number;
    accuracy: number;
    sampleSize: number;
    period: string;
  };
  drift: {
    detected: boolean;
    summary: string;
  };
  data: {
    totalPredictions: number;
    settledPredictions: number;
    pendingPredictions: number;
    lastPredictionAt: string;
  };
  catboost: {
    enabled: boolean;
    available: boolean;
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // 1. Modèle en production + nombre total de versions
    const [productionModel, totalVersions] = await Promise.all([
      prisma.modelVersion.findFirst({
        where: { status: "production" },
        orderBy: { promotedAt: "desc" },
      }),
      prisma.modelVersion.count(),
    ]);

    // 2. Métriques du modèle actif (dernières par marché principal)
    let brierScore = 0;
    let accuracy = 0;
    let sampleSize = 0;
    let period = "N/A";

    if (productionModel) {
      const latestMetrics = await prisma.modelMetrics.findFirst({
        where: { modelVersionId: productionModel.id },
        orderBy: { computedAt: "desc" },
      });

      if (latestMetrics) {
        brierScore = latestMetrics.brierScore;
        accuracy = latestMetrics.accuracy ?? 0;
        sampleSize = latestMetrics.sampleSize;
        period = latestMetrics.period;
      }
    }

    // 3. Détection de drift (fenêtre 7j vs baseline 90j)
    let driftDetected = false;
    let driftSummary = "Pas de modèle actif — drift non vérifiable";

    if (productionModel) {
      const now = new Date();
      const recentFrom = new Date(now);
      recentFrom.setDate(recentFrom.getDate() - 7);
      const baselineFrom = new Date(now);
      baselineFrom.setDate(baselineFrom.getDate() - 90);

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
            createdAt: { gte: baselineFrom, lt: recentFrom },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      if (recentLogs.length > 0 && baselineLogs.length > 0) {
        const driftResult = detectDrift(recentLogs, baselineLogs);
        driftDetected = driftResult.drifted;
        driftSummary = driftResult.summary;
      } else {
        driftSummary = "Données insuffisantes pour la détection de drift";
      }
    }

    // 4. Compteurs de prédictions
    const [totalPredictions, settledPredictions, lastPrediction] =
      await Promise.all([
        prisma.predictionLog.count(),
        prisma.predictionLog.count({ where: { settled: true } }),
        prisma.predictionLog.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    const pendingPredictions = totalPredictions - settledPredictions;

    // 5. État CatBoost
    const catboostEnabled =
      process.env.CATBOOST_ENABLED?.toLowerCase() === "true";
    const catboostAvailable = catboostEnabled; // TODO: vérifier chargement modèle

    // 6. Statut global
    let status: PredictionHealth["status"] = "healthy";

    if (!productionModel) {
      status = "critical";
    } else if (driftDetected) {
      status = "critical";
    } else if (sampleSize < 30) {
      status = "degraded";
    }

    const response: PredictionHealth = {
      status,
      model: {
        active: productionModel?.name ?? "aucun",
        totalVersions,
        lastTrainedAt: productionModel?.trainedAt?.toISOString() ?? "",
      },
      metrics: {
        brierScore,
        accuracy,
        sampleSize,
        period,
      },
      drift: {
        detected: driftDetected,
        summary: driftSummary,
      },
      data: {
        totalPredictions,
        settledPredictions,
        pendingPredictions,
        lastPredictionAt: lastPrediction?.createdAt?.toISOString() ?? "",
      },
      catboost: {
        enabled: catboostEnabled,
        available: catboostAvailable,
      },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/health]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
