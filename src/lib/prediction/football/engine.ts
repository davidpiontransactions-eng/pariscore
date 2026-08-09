// Moteur de prédiction football — core engine.
// Architecture : Elo → λ → Poisson → blend cotes → EV
// Contrats : EngineResult, Markets, LiveInputs (types.ts)

import type { EloConfig, EloPair, EngineResult, LiveInputs, LiveMarkets } from "./types";
import { DEFAULT_ELO_CONFIG } from "./types";
import { buildScoreMatrix, marketsFromMatrix, poissonMarkets } from "./poisson";
import { clamp01, round2 } from "./math-utils";

// ---------------------------------------------------------------------------
// Elo
// ---------------------------------------------------------------------------

export function eloProb(homeElo: number, awayElo: number, homeAdv = 100): number {
  const delta = homeElo + homeAdv - awayElo;
  return 1 / (1 + Math.pow(10, -delta / 400));
}

export function resolveElo(
  homeElo?: number,
  awayElo?: number,
  config: EloConfig = DEFAULT_ELO_CONFIG,
): { home: number; away: number; eloKnown: boolean } {
  const h = homeElo ?? config.init;
  const a = awayElo ?? config.init;
  return { home: h, away: a, eloKnown: homeElo != null && awayElo != null };
}

// ---------------------------------------------------------------------------
// xG adjustment
// ---------------------------------------------------------------------------

export function xgAdjustLambda(
  lambdaHome: number,
  lambdaAway: number,
  xgHome: number | null,
  xgAway: number | null,
  xgSampleSize: number = 5,
): EloPair {
  const leagueAvg = 1.35;
  if (xgHome == null || xgAway == null) {
    return { home: lambdaHome, away: lambdaAway };
  }
  const shrink = Math.min(1, xgSampleSize / 5);
  const xgHomeShrunk = xgHome * shrink + leagueAvg * (1 - shrink);
  const xgAwayShrunk = xgAway * shrink + leagueAvg * (1 - shrink);
  const wElo = 0.80, wXg = 0.20;
  return {
    home: round2(wElo * lambdaHome + wXg * xgHomeShrunk),
    away: round2(wElo * lambdaAway + wXg * xgAwayShrunk),
  };
}

// ---------------------------------------------------------------------------
// Market odds helpers
// ---------------------------------------------------------------------------

function impliedFromDecimal(odds: number): number {
  if (odds <= 0 || !Number.isFinite(odds)) return 0;
  return 1 / odds;
}

function demargin1X2(homeOdds: number, drawOdds: number, awayOdds: number): {
  home: number; draw: number; away: number;
} {
  const impH = impliedFromDecimal(homeOdds);
  const impD = impliedFromDecimal(drawOdds);
  const impA = impliedFromDecimal(awayOdds);
  const total = impH + impD + impA;
  if (total <= 0) return { home: 0, draw: 0, away: 0 };
  return { home: impH / total, draw: impD / total, away: impA / total };
}

// ---------------------------------------------------------------------------
// λ from Elo
// ---------------------------------------------------------------------------

function lambdaFromElo(homeElo: number, awayElo: number, homeAdv: number): EloPair {
  const pHome = eloProb(homeElo, awayElo, homeAdv);
  const totalLambda = 2.70;
  const skew = (pHome - 0.5) * 0.8;
  const homeShare = 0.5 + skew;
  return {
    home: round2(totalLambda * homeShare),
    away: round2(totalLambda * (1 - homeShare)),
  };
}

// ---------------------------------------------------------------------------
// EV calculation
// ---------------------------------------------------------------------------

export type EVResult = {
  homeEV: number | null;
  drawEV: number | null;
  awayEV: number | null;
  over25EV: number | null;
  bttsEV: number | null;
};

export function computeEV(
  modelProbs: { home: number; draw: number; away: number; over25: number; btts: number },
  odds?: { home: number; draw: number; away: number; over25?: number; btts?: number },
): EVResult {
  if (!odds) return { homeEV: null, drawEV: null, awayEV: null, over25EV: null, bttsEV: null };
  const mkt = demargin1X2(odds.home, odds.draw, odds.away);

  const homeEV = round2((modelProbs.home / 100 - mkt.home) * 100);
  const drawEV = round2((modelProbs.draw / 100 - mkt.draw) * 100);
  const awayEV = round2((modelProbs.away / 100 - mkt.away) * 100);

  let over25EV: number | null = null;
  if (odds.over25 && odds.over25 > 0) {
    over25EV = round2((modelProbs.over25 / 100 - impliedFromDecimal(odds.over25)) * 100);
  }

  let bttsEV: number | null = null;
  if (odds.btts && odds.btts > 0) {
    bttsEV = round2((modelProbs.btts / 100 - impliedFromDecimal(odds.btts)) * 100);
  }

  return { homeEV, drawEV, awayEV, over25EV, bttsEV };
}

// ---------------------------------------------------------------------------
// Engine principal — prematch
// ---------------------------------------------------------------------------

export type PrematchInputs = {
  homeElo?: number;
  awayElo?: number;
  xgHome?: number | null;
  xgAway?: number | null;
  xgSampleSize?: number;
  odds?: { home: number; draw: number; away: number; over25?: number; btts?: number };
  eloConfig?: EloConfig;
};

export function predictPrematch(inputs: PrematchInputs): EngineResult {
  const errors: string[] = [];
  const config = inputs.eloConfig ?? DEFAULT_ELO_CONFIG;

  const elo = resolveElo(inputs.homeElo, inputs.awayElo, config);
  let lambda = lambdaFromElo(elo.home, elo.away, config.homeAdv);

  if (inputs.xgHome != null || inputs.xgAway != null) {
    lambda = xgAdjustLambda(lambda.home, lambda.away,
      inputs.xgHome ?? null, inputs.xgAway ?? null, inputs.xgSampleSize ?? 5);
  }

  let markets = poissonMarkets(lambda.home, lambda.away);
  let modelSource: EngineResult["modelSource"] = "poisson";

  if (inputs.odds) {
    const mkt = demargin1X2(inputs.odds.home, inputs.odds.draw, inputs.odds.away);
    const wP = 0.55, wM = 0.45;
    markets = {
      ...markets,
      homeWin: round2(wP * markets.homeWin + wM * mkt.home * 100),
      draw: round2(wP * markets.draw + wM * mkt.draw * 100),
      awayWin: round2(wP * markets.awayWin + wM * mkt.away * 100),
    };
    modelSource = "blend";
  }

  const sum1X2 = markets.homeWin + markets.draw + markets.awayWin;
  if (Math.abs(sum1X2 - 100) > 0.5 && sum1X2 > 0) {
    const scale = 100 / sum1X2;
    markets.homeWin = round2(markets.homeWin * scale);
    markets.draw = round2(markets.draw * scale);
    markets.awayWin = round2(markets.awayWin * scale);
  }

  return {
    mode: "prematch",
    lambda,
    markets,
    elo: { home: elo.home, away: elo.away, eloKnown: elo.eloKnown },
    modelSource,
    errors,
  };
}
// ---------------------------------------------------------------------------
// Engine — live (decay model)
// ---------------------------------------------------------------------------

export function predictLive(prematchLambda: EloPair, inputs: LiveInputs): LiveMarkets {
  const minutesPlayed = Math.min(inputs.minute, 90);
  const remaining = Math.max(0, 90 - minutesPlayed);
  const fraction = remaining / 90;

  let lambdaHome = prematchLambda.home * fraction;
  let lambdaAway = prematchLambda.away * fraction;

  const goalDiff = inputs.scoreHome - inputs.scoreAway;
  if (goalDiff > 0) {
    lambdaHome *= 0.85; lambdaAway *= 1.10;
  } else if (goalDiff < 0) {
    lambdaHome *= 1.10; lambdaAway *= 0.85;
  }

  if (inputs.redCardHome > 0) lambdaHome *= Math.pow(0.75, inputs.redCardHome);
  if (inputs.redCardAway > 0) lambdaAway *= Math.pow(0.75, inputs.redCardAway);

  if (inputs.momentum15 != null) {
    const mom = clamp01((inputs.momentum15 + 1) / 2);
    lambdaHome *= 1 + (mom - 0.5) * 0.20;
    lambdaAway *= 1 + (0.5 - mom) * 0.20;
  }

  lambdaHome = round2(Math.max(0.05, lambdaHome));
  lambdaAway = round2(Math.max(0.05, lambdaAway));

  const mk = marketsFromMatrix(buildScoreMatrix(lambdaHome, lambdaAway));

  return {
    minute: inputs.minute,
    scoreHome: inputs.scoreHome,
    scoreAway: inputs.scoreAway,
    homeWin: mk.homeWin,
    draw: mk.draw,
    awayWin: mk.awayWin,
    over15: mk.over15,
    over25: mk.over25,
    over35: mk.over35,
    btts: mk.btts,
    lambdaRemaining: { home: lambdaHome, away: lambdaAway },
  };
}

