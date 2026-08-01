// Momentum Score — score 0-100 par joueur basé sur 5 signaux pondérés par
// la méthode EWM (Entropy Weight Method, Lei et al. 2024, IEEE Access).
//
// Architecture :
//   1. EWM calibré sur les joueurs du top-100 (via cache Elo + DR).
//   2. Si <30 joueurs en couverture → fallback sur DEFAULT_EWM_WEIGHTS.
//   3. 5 signaux par joueur :
//      - DR Moyen (5M)          — dominance ratio, cache dr-cache.json
//      - λ Aces                 — taux d'aces lissé (serveStats)
//      - Serve Pts Won %        — points gagnés au service
//      - Forme récente          — déjà dans les Inputs (0-1)
//      - Momentum live          — EWMA (hook use-momentum-dr, optionnel)
//   4. Normalisation min-max avec bornes empiriques ATP.
//   5. Sortie : score ∈ [0, 100] pour chaque joueur.

import { lookupDrMoyen, lookupServeStats } from "@/lib/tennis-dr/lookup";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerSignals {
  dr: number | null;
  acesLambda: number | null;
  servePtsWonPct: number | null;
  form: number;
  momentumLive: number | null;
}

export interface EwmWeights {
  dr: number;
  aces: number;
  servePts: number;
  form: number;
  momentum: number;
}

export interface MomentumScoreResult {
  scoreA: number;
  scoreB: number;
  weights: EwmWeights;
  source: string;
  signalsA: PlayerSignals;
  signalsB: PlayerSignals;
}

// ─── Poids fallback & bornes ─────────────────────────────────────────────────

export const DEFAULT_EWM_WEIGHTS: EwmWeights = {
  dr: 0.25, aces: 0.20, servePts: 0.20, form: 0.20, momentum: 0.15,
};

const DR_MIN = 0.8;
const DR_MAX = 1.8;
const ACES_LAMBDA_MAX = 15;
const SERVE_PTS_MIN = 0.55;
const SERVE_PTS_MAX = 0.78;

function norm(x: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

// ─── Cache EWM ───────────────────────────────────────────────────────────────

let _cachedWeights: EwmWeights | null = null;
let _cachedSource = "ewm-fallback-no-cache";

export function getEwmWeights(): { weights: EwmWeights; source: string } {
  if (_cachedWeights) return { weights: _cachedWeights, source: _cachedSource };
  try {
    const candidates = [
      resolve(process.cwd(), "src/lib/tennis-dr/ewm-weights.json"),
      resolve(process.cwd(), ".next/standalone/src/lib/tennis-dr/ewm-weights.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, "utf8"));
        if (data.weights) { _cachedWeights = data.weights as EwmWeights; _cachedSource = data.source; return { weights: data.weights as EwmWeights, source: _cachedSource }; }
      }
    }
  } catch { /* fallback */ }
  _cachedWeights = DEFAULT_EWM_WEIGHTS;
  _cachedSource = "ewm-fallback-no-weights-file";
  return { weights: _cachedWeights, source: _cachedSource };
}

export function resetEwmCache(): void { _cachedWeights = null; _cachedSource = "ewm-fallback-no-cache"; }

// ─── Construction des signaux ────────────────────────────────────────────────

export function buildPlayerSignals(
  playerName: string,
  surface: string,
  formScore: number,
  momentumLive?: number,
): PlayerSignals {
  const dr = lookupDrMoyen(playerName, surface);
  const serve = lookupServeStats(playerName, surface);
  const acesPct = serve?.acesPct ?? null;

  return {
    dr: dr ?? null,
    acesLambda: acesPct, // % → normalisé direct
    servePtsWonPct: serve?.servePtsWonPct ?? null,
    form: formScore,
    momentumLive: momentumLive ?? null,
  };
}

// ─── Calcul du score ─────────────────────────────────────────────────────────

function computeScore(signals: PlayerSignals, weights: EwmWeights): number {
  let totalWeight = 0;
  let weightedSum = 0;

  if (signals.dr != null) {
    weightedSum += weights.dr * norm(signals.dr, DR_MIN, DR_MAX);
    totalWeight += weights.dr;
  }
  if (signals.acesLambda != null) {
    weightedSum += weights.aces * norm(signals.acesLambda, 0, ACES_LAMBDA_MAX);
    totalWeight += weights.aces;
  }
  if (signals.servePtsWonPct != null) {
    weightedSum += weights.servePts * norm(signals.servePtsWonPct, SERVE_PTS_MIN, SERVE_PTS_MAX);
    totalWeight += weights.servePts;
  }
  weightedSum += weights.form * signals.form;
  totalWeight += weights.form;

  if (signals.momentumLive != null) {
    weightedSum += weights.momentum * (signals.momentumLive / 100);
    totalWeight += weights.momentum;
  }

  if (totalWeight === 0) return 50;
  return Math.round((weightedSum / totalWeight) * 100);
}

// ─── API publique ────────────────────────────────────────────────────────────

export function computeMomentumScore(
  nameA: string, nameB: string,
  surface: string,
  formA: number, formB: number,
  momentumA?: number, momentumB?: number,
): MomentumScoreResult {
  const { weights, source } = getEwmWeights();
  const signalsA = buildPlayerSignals(nameA, surface, formA, momentumA);
  const signalsB = buildPlayerSignals(nameB, surface, formB, momentumB);
  return {
    scoreA: computeScore(signalsA, weights),
    scoreB: computeScore(signalsB, weights),
    weights, source, signalsA, signalsB,
  };
}
