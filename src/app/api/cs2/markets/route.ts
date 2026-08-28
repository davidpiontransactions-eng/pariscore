import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import {
  buildCs2Prediction,
  buildCs2TeamModels,
} from "@/lib/cs2/predict-adapter";
import {
  simulateMapRounds,
  type Cs2MapName,
} from "@/lib/prediction/cs2/cs2-predictive-ml-engine";
import { handicapRoundMarkets } from "@/lib/prediction/cs2/handicap-rounds";
import { mapPlayProbability } from "@/lib/prediction/cs2/map-play-prob";
import {
  devig,
  expectedValue,
  kellyFraction,
  betVerdict,
  type BetVerdict,
} from "@/lib/cs2/ev";

const CACHE_TTL = 5 * 60_000; // 5 min — probas stables pré-match
const CALIB_TTL = 60 * 60_000; // 1 h — rapport backtest régénéré quotidiennement
const cache = createTtlCache<unknown>("__cs2MarketsCache");
let calibCache: { ts: number; data: Record<string, { verdict: string }> } = { ts: 0, data: {} };

const SIMS = 4000;

/** Lit le verdict de calibration par marché depuis data/cs2-backtest-report.json. */
function loadCalibration(): Record<string, { verdict: string }> {
  if (Date.now() - calibCache.ts < CALIB_TTL) return calibCache.data;
  try {
    const p = path.join(process.cwd(), "data", "cs2-backtest-report.json");
    if (fs.existsSync(p)) {
      calibCache = { ts: Date.now(), data: JSON.parse(fs.readFileSync(p, "utf8")) };
      return calibCache.data;
    }
  } catch {
    // Rapport absent/corrompu → calibration inconnue (verdicts SKIP par défaut).
  }
  calibCache = { ts: Date.now(), data: {} };
  return calibCache.data;
}

/** Seed déterministe à partir des noms d'équipes (résultats stables entre appels). */
function seedFromNames(team1: string, team2: string): number {
  let h = 2166136261;
  const s = `${team1.toLowerCase()}|${team2.toLowerCase()}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type MarketEv = {
  market: string;
  /** Proba modèle (0-1). */
  pModel: number | null;
  /** Cote décimale fournie (si disponible). */
  decimalOdds: number | null;
  /** EV en % (null si pas de cote). */
  ev: number | null;
  /** Fraction de Kelly (null si pas de cote). */
  kelly: number | null;
  verdict: BetVerdict | "NO_ODDS";
  calibration: string;
};

function buildEv(
  market: string,
  pModel: number | null,
  decimalOdds: number | null,
  calibration: Record<string, { verdict: string }>,
): MarketEv {
  const isCalibrated = calibration[market]?.verdict === "OK";
  const base: MarketEv = {
    market,
    pModel,
    decimalOdds,
    ev: null,
    kelly: null,
    verdict: "NO_ODDS",
    calibration: calibration[market]?.verdict ?? "UNKNOWN",
  };
  if (pModel == null) return base;
  if (!isCalibrated) return { ...base, verdict: "SKIP" };
  if (decimalOdds == null || decimalOdds <= 1) return base;
  return {
    ...base,
    ev: +expectedValue(pModel, decimalOdds).toFixed(2),
    kelly: +kellyFraction(pModel, decimalOdds).toFixed(4),
    verdict: betVerdict({ pModel, decimalOdds, calibrated: true }),
  };
}

/**
 * GET /api/cs2/markets?team1=&team2=&best_of=3[&odds_team1=1.85&odds_team2=2.0]
 * Agrège les marchés prédictifs calibrés CS2 : winner match, winner map, over/under
 * rounds, handicap rounds ±1.5/2.5 + proba de map jouée (veto) + EV/Kelly quand une
 * cote est fournie. Gate calibration : data/cs2-backtest-report.json.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const team1 = url.searchParams.get("team1") ?? "";
  const team2 = url.searchParams.get("team2") ?? "";
  const bestOfRaw = Number(url.searchParams.get("best_of") ?? 3);
  const bestOf = (bestOfRaw === 1 || bestOfRaw === 5 ? bestOfRaw : 3) as 1 | 3 | 5;
  const odds1 = Number(url.searchParams.get("odds_team1"));
  const odds2 = Number(url.searchParams.get("odds_team2"));

  if (!team1 || !team2) {
    return NextResponse.json({ error: "team1 & team2 requis" }, { status: 400 });
  }

  const cacheKey = `${team1.toLowerCase()}|${team2.toLowerCase()}|${bestOf}|${odds1}|${odds2}`;
  const entry = cache.getEntry();
  const cachedPayload = (cache.get() as { key?: string } | null) ?? null;
  if (entry && cachedPayload && (cachedPayload as { key?: string }).key === cacheKey && isFresh(entry, CACHE_TTL)) {
    return NextResponse.json(cachedPayload);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    const enrichment = await cs2Service.buildMatchEnrichment(team1, team2, undefined, key);
    const prediction = buildCs2Prediction(enrichment, bestOf, seedFromNames(team1, team2));
    if (!prediction) {
      return NextResponse.json({ error: "prediction unavailable" }, { status: 503 });
    }
    const models = buildCs2TeamModels(enrichment);

    // Handicap rounds : distribution Monte-Carlo de la map la plus probable.
    const top = prediction.predictedMaps[0];
    const dist = simulateMapRounds(
      top.winProb1,
      top.ctBias,
      top.pistolT1,
      top.pistolT2,
      SIMS,
      seedFromNames(team1, team2),
    );
    const handicapRounds = handicapRoundMarkets(dist, [1.5, 2.5], SIMS);

    // Proba de map jouée (veto + prior uniforme — historique pick/ban en P2).
    const mapPlayProb = models
      ? mapPlayProbability(models, bestOf, {} as Partial<Record<Cs2MapName, number>>)
      : null;

    // Dévig des cotes fournies (si les deux côtés sont présentes).
    let devigged: { pHome: number; pAway: number } | null = null;
    if (Number.isFinite(odds1) && odds1 > 1 && Number.isFinite(odds2) && odds2 > 1) {
      devigged = devig(1.05, { home: odds1, away: odds2 });
    }

    const calibration = loadCalibration();
    const winnerOdds = Number.isFinite(odds1) && odds1 > 1 ? odds1 : null;
    const hTop = handicapRounds[0];
    const evs: MarketEv[] = [
      buildEv("winner", prediction.winProb1, winnerOdds, calibration),
      // Cotes map/over/handicap non exposées par BSD → EV null jusqu'à intégration Pinnacle.
      buildEv("map", top.winProb1, null, calibration),
      buildEv("over", top.overProb, null, calibration),
      buildEv(
        "handicap",
        top.winProb1 >= 0.5 ? hTop?.probT1Cover ?? null : hTop?.probT2Cover ?? null,
        null,
        calibration,
      ),
    ];

    const payload = {
      key: cacheKey,
      team1: prediction.team1,
      team2: prediction.team2,
      bestOf,
      winProb1: prediction.winProb1,
      winProb2: prediction.winProb2,
      predictedMaps: prediction.predictedMaps,
      handicapRounds,
      mapPlayProb,
      odds: Number.isFinite(odds1) && odds1 > 1
        ? { team1: odds1, team2: Number.isFinite(odds2) ? odds2 : null }
        : null,
      devigged,
      evs,
      topMap: top.map,
      source: "bradley-terry-mc12",
      simulations: SIMS,
    };
    cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 markets unavailable", details: (err as Error).message },
      { status: 503 },
    );
  }
}