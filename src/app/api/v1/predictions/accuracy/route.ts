/**
 * GET /api/v1/predictions/accuracy — Métriques de précision du modèle football.
 *
 * Calcule en temps réel (ou lit depuis un cache) les métriques de calibration
 * via walk-forward validation sur les matchs récents terminés.
 *
 * Réponse : Brier score, log-loss, calibration, sampleSize, period, markets.
 */
import { NextResponse } from "next/server";
import { walkForwardValidation, type WalkForwardResult } from "@/lib/prediction/football/walk-forward";
import { calibrationCurve, type CalibrationBin } from "@/lib/prediction/football/brier-score";
import { round2 } from "@/lib/prediction/football/math-utils";
import type { FootballMatch } from "@/lib/football-data";

// ---------------------------------------------------------------------------
// Types réponse
// ---------------------------------------------------------------------------

type MarketAccuracy = {
  brier: number;
  logLoss: number;
  accuracy: number;
  roi: number;
  sampleSize: number;
};

type AccuracyResponse = {
  brierScore: number;
  logLoss: number;
  accuracy: number;
  calibration: CalibrationBin[];
  sampleSize: number;
  period: { from: string; to: string; matchCount: number };
  markets: {
    "1X2": MarketAccuracy;
    BTTS: MarketAccuracy;
    O25: MarketAccuracy;
  };
  windows: number;
};

// ---------------------------------------------------------------------------
// Charge les matchs terminés depuis la source de données
// ---------------------------------------------------------------------------

/**
 * Récupère les matchs terminés récents.
 * En prod, cela pourrait venir d'une DB ; ici on importe depuis le fetcher BSD.
 */
async function fetchFinishedMatches(): Promise<FootballMatch[]> {
  try {
    // Import dynamique pour éviter les erreurs côté bundle
    const mod = await import("@/lib/bsd-football-fetcher");
    const fetchMatches = (mod as Record<string, unknown>)["fetchFootballMatches"];
    if (typeof fetchMatches === "function") {
      const all = await fetchMatches();
      return Array.isArray(all) ? all : [];
    }
  } catch {
    // Fallback : retournne un tableau vide si le fetcher n'est pas disponible
  }
  return [];
}

// ---------------------------------------------------------------------------
// Paramètres walk-forward par défaut
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
  trainWindow: 100,
  testWindow: 20,
  stepSize: 20,
};

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trainWindow = parseInt(searchParams.get("trainWindow") ?? String(DEFAULT_OPTIONS.trainWindow), 10);
    const testWindow = parseInt(searchParams.get("testWindow") ?? String(DEFAULT_OPTIONS.testWindow), 10);
    const stepSize = parseInt(searchParams.get("stepSize") ?? String(DEFAULT_OPTIONS.stepSize), 10);

    if (!Number.isFinite(trainWindow) || trainWindow < 10) {
      return NextResponse.json({ error: "trainWindow doit être ≥ 10" }, { status: 400 });
    }
    if (!Number.isFinite(testWindow) || testWindow < 1) {
      return NextResponse.json({ error: "testWindow doit être ≥ 1" }, { status: 400 });
    }
    if (!Number.isFinite(stepSize) || stepSize < 1) {
      return NextResponse.json({ error: "stepSize doit être ≥ 1" }, { status: 400 });
    }

    // Chargement des matchs
    const matches = await fetchFinishedMatches();
    if (matches.length === 0) {
      return NextResponse.json({
        error: "Aucun match terminé disponible",
        sampleSize: 0,
      }, { status: 200 });
    }

    // Walk-forward validation
    const wfResult: WalkForwardResult = walkForwardValidation(matches, {
      trainWindow,
      testWindow,
      stepSize,
    });

    // Courbe de calibration globale (1X2 uniquement)
    const predictions1X2 = wfResult.predictions.filter(
      (p) => !p.pick.startsWith("BTTS_") && !p.pick.startsWith("OU_"),
    );
    const calibration = predictions1X2.length > 0
      ? calibrationCurve(
          predictions1X2.map((p) => p.predicted),
          predictions1X2.map((p) => p.actual),
          10,
        )
      : [];

    // Période couverte
    const dates = wfResult.predictions.map((p) => new Date(p.date).getTime()).filter(Number.isFinite);
    const period = {
      from: dates.length > 0 ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : "",
      to: dates.length > 0 ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "",
      matchCount: wfResult.predictions.length,
    };

    const m = wfResult.metrics;

    const response: AccuracyResponse = {
      brierScore: m.brierScore,
      logLoss: m.logLoss,
      accuracy: m.accuracy,
      calibration,
      sampleSize: wfResult.predictions.length,
      period,
      markets: {
        "1X2": m.markets["1X2"],
        BTTS: m.markets.BTTS,
        O25: m.markets.O25,
      },
      windows: wfResult.windows,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    console.error("[predictions/accuracy]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
