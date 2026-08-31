/**
 * POST /api/v1/predictions/settle — Settle predictions with actual match scores.
 *
 * Accepte un matchId + scores réels et met à jour les PredictionLog correspondantes.
 * Peut also accepter un batch de settle via un tableau de matchs.
 *
 * Body: { matchId: string, homeScore: number, awayScore: number }
 * OU:   { settlements: Array<{ matchId: string, homeScore: number, awayScore: number }> }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettlementRequest = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

type BatchSettlementRequest = {
  settlements: SettlementRequest[];
};

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SettlementRequest | BatchSettlementRequest;

    // Batch mode
    if ("settlements" in body && Array.isArray(body.settlements)) {
      const results = await settleBatch(body.settlements);
      return NextResponse.json(results);
    }

    // Single mode
    const { matchId, homeScore, awayScore } = body as SettlementRequest;

    if (!matchId || typeof matchId !== "string") {
      return NextResponse.json(
        { error: "matchId requis (string)" },
        { status: 400 },
      );
    }
    if (homeScore == null || awayScore == null || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return NextResponse.json(
        { error: "homeScore et awayScore requis (nombres)" },
        { status: 400 },
      );
    }

    const result = await settleOne(matchId, homeScore, awayScore);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/settle]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function settleOne(matchId: string, homeScore: number, awayScore: number) {
  const updated = await prisma.predictionLog.updateMany({
    where: {
      matchId,
      settled: false,
    },
    data: {
      actualHome: homeScore,
      actualAway: awayScore,
      settled: true,
    },
  });

  return {
    matchId,
    homeScore,
    awayScore,
    settled: updated.count,
    message: updated.count > 0
      ? `${updated.count} prédiction(s) settlée(s)`
      : "Aucune prédiction en attente pour ce matchId",
  };
}

async function settleBatch(settlements: SettlementRequest[]) {
  const results = [];

  for (const s of settlements) {
    try {
      const result = await settleOne(s.matchId, s.homeScore, s.awayScore);
      results.push({ ...result, success: true });
    } catch (err) {
      results.push({
        matchId: s.matchId,
        success: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  const totalSettled = results.reduce((sum, r) => sum + (r.settled ?? 0), 0);
  return {
    total: settlements.length,
    settled: totalSettled,
    results,
  };
}
