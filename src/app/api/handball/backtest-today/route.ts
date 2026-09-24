import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import {
  resolveHandballDataFile,
  toHandballMatch,
  type FlashscoreMatch,
} from "@/lib/handball-flashscore";
import {
  computeDailyStrategyBacktest,
  parisDateOf,
  type DailyStrategyBacktest,
} from "@/lib/handball-backtest-today";

// Cache 15 min (miroir /api/handball/backtest) — la clé porte la date pour ne
// jamais servir le backtest d'hier après minuit Europe/Paris.
const CACHE_TTL_MS = 15 * 60_000;

type Payload = DailyStrategyBacktest & { source: "file" | "live" };
type CacheValue = { date: string; payload: Payload };
const cache = createTtlCache<CacheValue>("__handballBacktestTodayCache");

/** Snapshot flashscore_handball.json complet (mapping partagé). */
function loadSnapshotMatches() {
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const raw = (data.matches || []) as FlashscoreMatch[];
    return raw.filter((m) => m.home && m.away).map((m, i) => toHandballMatch(m, i));
  } catch {
    return [];
  }
}

/**
 * GET /api/handball/backtest-today — backtest des 8 stratégies sur le jour courant.
 *
 * Fichier d'abord : lit data/handball_backtest_today.json (écrit par
 * scripts/backtest-handball-today.js, cron PM2 pariscore-cron-handball-nightly)
 * SI sa date === aujourd'hui Europe/Paris ; sinon recalcul à la volée depuis le
 * snapshot (fallback : cron manquant, premier déploiement, passage de minuit).
 * `source` expose la provenance pour l'UI et le débogage.
 */
export async function GET() {
  try {
    const date = parisDateOf(new Date());

    const entry = cache.getEntry();
    if (entry && isFresh(entry, CACHE_TTL_MS) && entry.data.date === date) {
      return NextResponse.json(entry.data.payload);
    }

    // 1. Fichier pré-calculé (cron nightly)
    try {
      const filePath = resolveHandballDataFile("handball_backtest_today.json");
      if (filePath) {
        const file = JSON.parse(readFileSync(filePath, "utf-8")) as DailyStrategyBacktest;
        if (file?.date === date && Array.isArray(file.strategies)) {
          const payload: Payload = { ...file, source: "file" };
          cache.set({ date, payload });
          return NextResponse.json(payload);
        }
      }
    } catch {
      // Fichier absent/corrompu → calcul à la volée
    }

    // 2. Recalcul depuis le snapshot
    const payload: Payload = {
      ...computeDailyStrategyBacktest(loadSnapshotMatches(), { date }),
      source: "live",
    };
    cache.set({ date, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "handball/backtest-today");
  }
}
