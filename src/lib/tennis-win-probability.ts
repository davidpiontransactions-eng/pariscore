/**
 * Calcul de probabilité de victoire tennis — Sigmoid composite.
 * Source : Gao & Kowalczyk (2019) — serve strength = #1 predictor.
 * Ajustements surface : Xie & Muppidi (2026) — hybrid model.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PlayerStats {
  elo: number;
  eloSurface: number;
  holdPct: number;       // 0-1
  breakPct: number;      // 0-1
  formL5: number;        // 0-5 (victoires sur 5 matchs)
  h2hWins: number;
  h2hTotal: number;
  matchesLast7d: number;
  acesPerMatch: number;
}

export interface MatchContext {
  surface: string;
  tournamentCategory: string;
  round: string;
  isBo5: boolean;
}

export interface WinProbResult {
  probA: number;         // 0-100
  probB: number;         // 0-100
  confidence: number;    // 0-1
  pick: "A" | "B";
}

// ─── Surface factors (Gao 2019) ────────────────────────────────────────────

const SURFACE_ELO_FACTORS: Record<string, number> = {
  hard: 1.00,
  clay: 0.85,
  grass: 1.15,
  indoor: 1.05,
};

const SURFACE_HOLD_FACTORS: Record<string, number> = {
  hard: 1.00,
  clay: 0.90,
  grass: 1.12,
  indoor: 1.05,
};

const SURFACE_BREAK_FACTORS: Record<string, number> = {
  hard: 1.00,
  clay: 1.15,
  grass: 0.85,
  indoor: 0.95,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ─── Compute win probability ──────────────────────────────────────────────

/**
 * Calcule la probabilité de victoire du joueur A en %.
 * Méthode : Sigmoid composite (Gao 2019 + ajustements surface).
 */
export function computeWinProbability(
  playerA: PlayerStats,
  playerB: PlayerStats,
  ctx: MatchContext,
): WinProbResult {
  const surface = ctx.surface.toLowerCase();

  // 1. Elo surface-adjusted
  const eloA = playerA.eloSurface * (SURFACE_ELO_FACTORS[surface] ?? 1.0);
  const eloB = playerB.eloSurface * (SURFACE_ELO_FACTORS[surface] ?? 1.0);
  const eloDiff = (eloA - eloB) / 400;

  // 2. Hold% surface-adjusted
  const holdA = playerA.holdPct * (SURFACE_HOLD_FACTORS[surface] ?? 1.0);
  const holdB = playerB.holdPct * (SURFACE_HOLD_FACTORS[surface] ?? 1.0);
  const holdDiff = (holdA - holdB) / 100;

  // 3. Break% surface-adjusted
  const breakA = playerA.breakPct * (SURFACE_BREAK_FACTORS[surface] ?? 1.0);
  const breakB = playerB.breakPct * (SURFACE_BREAK_FACTORS[surface] ?? 1.0);
  const breakDiff = (breakA - breakB) / 100;

  // 4. Forme L5
  const formA = playerA.formL5 / 5;
  const formB = playerB.formL5 / 5;
  const formDiff = formA - formB;

  // 5. H2H
  const h2hA = playerA.h2hTotal > 0 ? playerA.h2hWins / playerA.h2hTotal : 0.5;
  const h2hB = playerB.h2hTotal > 0 ? playerB.h2hWins / playerB.h2hTotal : 0.5;
  const h2hDiff = h2hA - h2hB;

  // 6. Fatigue (on parie CONTRE le fatigué)
  const fatigueA = playerA.matchesLast7d / 5;
  const fatigueB = playerB.matchesLast7d / 5;
  const fatigueDiff = fatigueB - fatigueA;

  // Sigmoid composite
  const z =
    0.30 * eloDiff +
    0.25 * holdDiff +
    0.15 * breakDiff +
    0.15 * formDiff +
    0.10 * h2hDiff +
    0.05 * fatigueDiff;

  const probA = Math.round(sigmoid(z) * 1000) / 10;
  const probB = Math.round((100 - probA) * 10) / 10;

  // Confiance basée sur la qualité des données
  const confidence = computeConfidence(playerA, playerB, ctx);

  return {
    probA,
    probB,
    confidence,
    pick: probA >= probB ? "A" : "B",
  };
}

function computeConfidence(
  a: PlayerStats,
  b: PlayerStats,
  ctx: MatchContext,
): number {
  let conf = 0.5;

  if (a.elo > 0 && b.elo > 0) conf += 0.15;
  if (a.holdPct > 0 && b.holdPct > 0) conf += 0.10;
  if (a.formL5 > 0 && b.formL5 > 0) conf += 0.10;
  if (a.h2hTotal > 0 && b.h2hTotal > 0) conf += 0.05;
  if (ctx.surface !== "hard") conf += 0.05;
  if (/grand.slam|australian|roland.garros|wimbledon|us.open/i.test(ctx.tournamentCategory)) {
    conf += 0.05;
  }

  return Math.min(conf, 1.0);
}

/**
 * Calcule la probabilité de victoire en live (Markov blend).
 * Blend le pre-match avec le score en cours.
 * Source : Xie (2026) — 76% at 25%, 82% at 50%, 88% at 75%.
 */
export function computeLiveWinProbability(
  probPreMatchA: number,
  scoreSets: { a: number; b: number },
  scoreGames: { a: number; b: number },
  holdObserved: { a: number; b: number },
  isBo5: boolean,
): number {
  const totalSets = isBo5 ? 5 : 3;
  const setsPlayed = scoreSets.a + scoreSets.b;
  const progression = setsPlayed / totalSets;

  // Poids live vs pre-match (Xie 2026)
  const liveWeight = sigmoid((progression - 0.3) * 10);

  // Prob live basée sur le score
  const setAdvantage = scoreSets.a - scoreSets.b;
  const gameAdvantage = scoreGames.a - scoreGames.b;
  const holdAdvantage = (holdObserved.a - holdObserved.b) * 100;

  const zLive =
    0.40 * setAdvantage +
    0.30 * gameAdvantage +
    0.20 * holdAdvantage +
    0.10 * (probPreMatchA / 100 - 0.5) * 2;

  const probLive = sigmoid(zLive) * 100;

  // Blend
  const probBlend = (1 - liveWeight) * probPreMatchA + liveWeight * probLive;

  return Math.max(0, Math.min(100, Math.round(probBlend * 10) / 10));
}
