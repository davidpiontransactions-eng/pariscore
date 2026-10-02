// GET /api/v1/snooker/backtest?window=full|d365|season
// Backtest walk-forward du modèle snooker sur l'historique SnookerDB
// (data/snooker_history.db — voir scripts/fetch-snooker-history.mjs).
// Crash-proof SWR : réponses TOUJOURS 200, base absente → payload vide + error.
// Piège data : `walkover` TEXT mixte ('False'/'True' + '0'/'1') — le filtre
// sémantique est dans snooker-history-db.ts, ne jamais réécrire `= 0` ici.

import { NextResponse } from "next/server";
import { loadSnookerBacktestRows, loadSnookerRankings } from "@/lib/snooker/snooker-history-db";
import {
  computeSnookerBacktest,
  type SnookerBtWindow,
  type SnookerBacktestResponse,
} from "@/lib/snooker/backtest-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 15 * 60_000; // 15 min : snapshot par fenêtre
const VALID_WINDOWS: SnookerBtWindow[] = ["full", "d365", "season"];

const _cache = new Map<string, { at: number; payload: SnookerBacktestResponse }>();

function emptyPayload(window: SnookerBtWindow, error: string): SnookerBacktestResponse {
  return {
    window,
    from: "",
    to: "",
    nMatches: 0,
    source: "snookerdb",
    attribution: "SnookerDB / CueTracker (GPL-3.0)",
    computedAt: new Date().toISOString(),
    metrics: { accuracy: 0, brier: 0, logLoss: 0 },
    baseline: { label: "Favori au classement", accuracy: 0, n: 0 },
    calibration: [],
    dimensions: [],
    error,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("window") ?? "full";
  const window: SnookerBtWindow = VALID_WINDOWS.includes(raw as SnookerBtWindow)
    ? (raw as SnookerBtWindow)
    : "full";

  try {
    const hit = _cache.get(window);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return NextResponse.json(hit.payload);
    }

    const rows = loadSnookerBacktestRows();
    if (rows.length === 0) {
      return NextResponse.json(
        emptyPayload(window, "Base absente — lancez node scripts/fetch-snooker-history.mjs"),
      );
    }

    const rankings = loadSnookerRankings();
    const payload = computeSnookerBacktest(rows, rankings, { window });
    if (payload.nMatches === 0 && !payload.error) {
      payload.error = `fenêtre "${window}" sans match`;
    }

    _cache.set(window, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      emptyPayload(window, err instanceof Error ? err.message : "erreur backtest snooker"),
    );
  }
}
