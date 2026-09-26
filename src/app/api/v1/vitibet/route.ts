import { NextRequest, NextResponse } from "next/server";
import {
  getBacktest,
  getTipsByDate,
  getTopByIndex,
  parisToday,
  scoreErrorSigma,
} from "@/lib/vitibet/db";
import type { VitibetBacktestResult, VitibetTip } from "@/lib/vitibet/types";

// Pronostics Vitibet handball (table vitibet_tips, pariscore.db).
// GET ?date=AAAA-MM-JJ → fenêtre J→J+3 ; ?top=N → top N par |INDEX| ;
//     ?backtest=1 → taux de réussite des tips (FT vs prédit, T6).
// Cache mémoire 10 min : les données ne bougent qu'aux runs du cron (2×/jour).
// `scoreSigma` (σ des erreurs de prédiction des totaux) accompagne les tips :
// alimente le pill « Over XX pts conseillé » (seuil 65 %, f1qc).

const CACHE_TTL = 10 * 60_000;

const _cache = new Map<string, { at: number; tips: VitibetTip[] }>();

let _backtestEntry: { at: number; backtest: VitibetBacktestResult } | null = null;
let _sigmaEntry: { at: number; sigma: { sigma: number; n: number } | null } | null = null;

/** σ avec cache 10 min (comptage d'échantillon coûteux à chaque requête). */
function getSigma(): { sigma: number; n: number } | null {
  if (!_sigmaEntry || Date.now() - _sigmaEntry.at > CACHE_TTL) {
    _sigmaEntry = { at: Date.now(), sigma: scoreErrorSigma() };
  }
  return _sigmaEntry.sigma;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const topRaw = params.get("top");
  const dateRaw = params.get("date");

  // Backtest (T6) : taux de réussite des tips — même cache 10 min.
  if (params.get("backtest") !== null) {
    if (!_backtestEntry || Date.now() - _backtestEntry.at > CACHE_TTL) {
      _backtestEntry = { at: Date.now(), backtest: getBacktest() };
    }
    return NextResponse.json(
      {
        backtest: _backtestEntry.backtest,
        generatedAt: new Date(_backtestEntry.at).toISOString(),
      },
      { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1800" } }
    );
  }

  const key = topRaw ? `top:${topRaw}` : `date:${dateRaw || "today"}`;
  let entry = _cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL) {
    const tips = topRaw
      ? getTopByIndex(Number(topRaw))
      : getTipsByDate(dateRaw || parisToday());
    entry = { at: Date.now(), tips };
    _cache.set(key, entry);
  }

  return NextResponse.json(
    {
      count: entry.tips.length,
      tips: entry.tips,
      scoreSigma: getSigma(),
      generatedAt: new Date(entry.at).toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1800" } }
  );
}
