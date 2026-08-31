/**
 * POST /api/v1/predictions/compute — Calcul de prédiction football à la demande.
 *
 * Accepte un matchId + paramètres optionnels (Elo, xG) et retourne
 * les probabilités calculées par le moteur statistique (Poisson) et le ML hybride.
 */
import { NextResponse } from "next/server";
import { predictPrematch, type PrematchInputs } from "@/lib/prediction/football/engine";
import { predictML, type MLEngineInputs, type MLPrediction } from "@/lib/prediction/football/prediction-ml-engine";
import type { FootballMatch, Prediction } from "@/lib/football-data";
import { round2 } from "@/lib/prediction/football/math-utils";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types requête / réponse
// ---------------------------------------------------------------------------

type ComputeRequest = {
  matchId: string;
  homeElo?: number;
  awayElo?: number;
  homeXG?: number;
  awayXG?: number;
};

type ComputeResponse = {
  matchId: string;
  markets: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    bttsProb: number;
    over25Prob: number;
  };
  model: string;
  confidence: number;
  edge?: number;
  ml?: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    trend: string;
    summary: string;
  };
};

// ---------------------------------------------------------------------------
// Construit un FootballMatch minimal pour le moteur ML.
// Les champs absents seront remplacés par des défauts raisonnables dans extractFeatures.
// ---------------------------------------------------------------------------

function buildMinimalMatch(matchId: string): FootballMatch {
  const defaultPred: Prediction = {
    homeProb: 33,
    drawProb: 34,
    awayProb: 33,
    bttsProb: 50,
    over25Prob: 50,
    model: "compute-api",
  };

  return {
    id: matchId,
    league: {
      id: "unknown",
      name: "Inconnue",
      country: "",
      countryCode: "",
      logo: "",
      tier: "T2",
    },
    round: "Compute",
    scheduledAt: new Date().toISOString(),
    home: {
      id: "home",
      name: "Domicile",
      shortName: "DOM",
      logo: "",
      color: "#004170",
      form: [],
      rank: 0,
    },
    away: {
      id: "away",
      name: "Extérieur",
      shortName: "EXT",
      logo: "",
      color: "#EF0107",
      form: [],
      rank: 0,
    },
    prediction: defaultPred,
  };
}

// ---------------------------------------------------------------------------
// Calcul de la confiance basé sur l'écart Elo et la cohérence des modèles
// ---------------------------------------------------------------------------

function computeConfidence(
  homeElo?: number,
  awayElo?: number,
  mlPrediction?: MLPrediction,
): number {
  let score = 50; // base neutre

  // Bonus si Elo connu (±15)
  if (homeElo != null && awayElo != null) {
    const gap = Math.abs(homeElo - awayElo);
    if (gap > 200) score += 15;
    else if (gap > 100) score += 10;
    else if (gap > 50) score += 5;
  }

  // Bonus si les modèles convergent (±20)
  if (mlPrediction) {
    const statProbs = mlPrediction.sources.dixonColes;
    const rfProbs = mlPrediction.sources.rf;
    const divergence = Math.abs(statProbs.home - rfProbs.home) * 100;
    if (divergence < 5) score += 20;
    else if (divergence < 10) score += 10;
    else if (divergence > 20) score -= 10;
  }

  return Math.max(10, Math.min(95, Math.round(score)));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ComputeRequest;

    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json(
        { error: "matchId requis (string)" },
        { status: 400 },
      );
    }

    // Validation des types optionnels
    const homeElo = body.homeElo != null ? Number(body.homeElo) : undefined;
    const awayElo = body.awayElo != null ? Number(body.awayElo) : undefined;
    const homeXG = body.homeXG != null ? Number(body.homeXG) : undefined;
    const awayXG = body.awayXG != null ? Number(body.awayXG) : undefined;

    if (homeElo != null && !Number.isFinite(homeElo)) {
      return NextResponse.json({ error: "homeElo doit être un nombre fini" }, { status: 400 });
    }
    if (awayElo != null && !Number.isFinite(awayElo)) {
      return NextResponse.json({ error: "awayElo doit être un nombre fini" }, { status: 400 });
    }
    if (homeXG != null && !Number.isFinite(homeXG)) {
      return NextResponse.json({ error: "homeXG doit être un nombre fini" }, { status: 400 });
    }
    if (awayXG != null && !Number.isFinite(awayXG)) {
      return NextResponse.json({ error: "awayXG doit être un nombre fini" }, { status: 400 });
    }

    // --- Moteur statistique (Poisson) ---
    const prematchInputs: PrematchInputs = {
      homeElo: homeElo ?? undefined,
      awayElo: awayElo ?? undefined,
      xgHome: homeXG ?? null,
      xgAway: awayXG ?? null,
    };
    const engineResult = predictPrematch(prematchInputs);
    const mk = engineResult.markets!;

    // --- Moteur ML hybride ---
    const match = buildMinimalMatch(body.matchId);
    const mlInputs: MLEngineInputs = {
      match,
      homeElo: homeElo ?? undefined,
      awayElo: awayElo ?? undefined,
    };
    const mlResult = predictML(mlInputs);

    // --- Confiance & edge ---
    const confidence = computeConfidence(homeElo, awayElo, mlResult);

    // Edge = écart moyen entre les probabilités ML et les probabilités Poisson (%)
    const avgPoisson = (mk.homeWin + mk.draw + mk.awayWin) / 3;
    const avgMl = (mlResult.homeProb + mlResult.drawProb + mlResult.awayProb) / 3;
    const edge = round2(Math.abs(avgMl - avgPoisson));

    // --- Réponse ---
    const response: ComputeResponse = {
      matchId: body.matchId,
      markets: {
        homeProb: mlResult.homeProb,
        drawProb: mlResult.drawProb,
        awayProb: mlResult.awayProb,
        bttsProb: round2(mlResult.markets.btts),
        over25Prob: round2(mlResult.markets.over25),
      },
      model: `blend-poisson-rf-xgb`,
      confidence,
      edge: edge > 0 ? edge : undefined,
      ml: {
        homeProb: mlResult.homeProb,
        drawProb: mlResult.drawProb,
        awayProb: mlResult.awayProb,
        trend: mlResult.trend,
        summary: mlResult.summary,
      },
    };

    // --- Log prediction en DB pour métriques futures ---
    try {
      const activeModel = await prisma.modelVersion.findFirst({
        where: { status: "production" },
        orderBy: { promotedAt: "desc" },
      });
      await prisma.predictionLog.create({
        data: {
          matchId: body.matchId,
          modelVersionId: activeModel?.id ?? null,
          homeProb: mlResult.homeProb,
          drawProb: mlResult.drawProb,
          awayProb: mlResult.awayProb,
          bttsProb: round2(mlResult.markets.btts),
          over25Prob: round2(mlResult.markets.over25),
          edge: edge > 0 ? edge : null,
          confidence,
        },
      });
    } catch (logErr) {
      // Non-bloquant : le calcul est déjà fait
      console.error("[predictions/compute] log error:", logErr);
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/compute]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
