/**
 * Tennis Live Metrics — Moteur de calcul dérivé pour métriques décisionnelles in-play.
 *
 * Calcule à partir des stats live BSD (cumulées, set courant) :
 *   M1 — Dominance Ratio classique (O'Shaughnessy)
 *   M3 — Vulnérabilité 2nd service
 *   M4 — Exposition aux balles de break
 *   M6 — Hold Probability live (ajustée au score du jeu)
 *   M7 — Alerte composite fatigue / break imminent
 *
 * Tous les calculs sont synchrones (arithmétique pure, pas d'appel réseau).
 * Coût : < 1ms par match. Latence ajoutée : nulle.
 *
 * @module tennis-live-metrics
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Stats live BSD brutes (sous-ensemble utilisé par les métriques). */
export type LiveStatsSnapshot = {
  p1_aces: number | null;
  p2_aces: number | null;
  p1_df: number | null;
  p2_df: number | null;
  p1_first_pct: number | null;
  p2_first_pct: number | null;
  p1_first_won: number | null;
  p2_first_won: number | null;
  p1_second_won: number | null;
  p2_second_won: number | null;
  p1_bp_saved: number | null;
  p2_bp_saved: number | null;
};

export type DrLevel =
  | "dominant" | "favorable" | "neutral" | "unfavorable" | "dominated";

export type DrResult = {
  drA: number;
  drB: number;
  levelA: DrLevel;
  levelB: DrLevel;
  labelA: string;
  labelB: string;
};

export type SecondServeAlert = {
  player: "A" | "B" | null;
  pct: number;
  level: "critical" | "warning" | "ok";
};

export type BPExposure = {
  p1SavePct: number | null;
  p2SavePct: number | null;
};

export type FatigueAlert = {
  level: "none" | "pressure" | "break_imminent";
  player: "A" | "B" | null;
  message: string;
};

export type CalculatedLiveMetrics = {
  dr: DrResult;
  secondServeAlert: SecondServeAlert;
  bpExposure: BPExposure;
  holdProbA: number | null;
  holdProbB: number | null;
  fatigueAlert: FatigueAlert;
  /** Dynamic Pressure Index — score 0-100 synthétique. */
  pressureIndex: number;
};
// ─── Constantes ──────────────────────────────────────────────────────────────

const DR_DOMINANT = 1.35;
const DR_FAVORABLE = 1.20;
const DR_NEUTRAL_LOW = 0.85;
const DR_UNFAVORABLE_LOW = 0.75;

const SECOND_CRITICAL = 40;
const SECOND_WARNING = 45;
const FIRST_DROP_WARN = 10;
const FIRST_DROP_CRIT = 15;
const DR_OPP_PRESSURE = 1.10;
const DR_OPP_CRITICAL = 1.25;

const HOLD_ADJ: Record<string, number> = {
  // Keys: "{p1}-{p2}" with raw point counts (0/1/2/3/4+)
  "0-0": 0,   "1-0": +12, "2-0": +18, "3-0": +25,
  "0-1": -8,  "0-2": -16, "0-3": -28,
  "1-1": 0,   "1-2": -10, "1-3": -22,
  "2-1": +8,  "2-2": -2,  "2-3": -20,
  "3-1": +20, "3-2": +15, "3-3": -5,
  "4-3": +22, "3-4": -24,  // Av.-40 / 40-Av.
  "4-4": -5,                // Deuce prolongé
  "5-4": +22, "4-5": -24,  // 2e avantage
};

const DR_LABELS: Record<DrLevel, string> = {
  dominant: "Dominant", favorable: "Favorable", neutral: "Neutre",
  unfavorable: "Défavorable", dominated: "Dominé",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function safeNum(v: number | null | undefined, fb = 0): number {
  return v != null && !isNaN(v) ? v : fb;
}
// ─── M1 : Dominance Ratio Classique ─────────────────────────────────────────

/**
 * DR = % pts retour gagnés / % pts service perdus (O'Shaughnessy 2002).
 * Estimation : srvWon = moyenne pondérée 1st/2nd ; retWon = 1 - srvWon_opp.
 */
export function computeDominanceRatio(stats: LiveStatsSnapshot): DrResult {
  function estSrvWon(fp: number | null, fw: number | null, sw: number | null) {
    const fPct = safeNum(fp, 60) / 100;
    const fWon = safeNum(fw, 70) / 100;
    const sWon = safeNum(sw, 50) / 100;
    return clamp(fPct * fWon + (1 - fPct) * sWon, 0.05, 0.95);
  }
  const srvA = estSrvWon(stats.p1_first_pct, stats.p1_first_won, stats.p1_second_won);
  const srvB = estSrvWon(stats.p2_first_pct, stats.p2_first_won, stats.p2_second_won);

  const retA = 1 - srvB;
  const retB = 1 - srvA;

  const drA = (1 - srvA) > 0.01 ? retA / (1 - srvA) : 1.0;
  const drB = (1 - srvB) > 0.01 ? retB / (1 - srvB) : 1.0;

  function classify(dr: number): DrLevel {
    if (dr >= DR_DOMINANT) return "dominant";
    if (dr >= DR_FAVORABLE) return "favorable";
    if (dr <= DR_UNFAVORABLE_LOW) return "dominated";
    if (dr <= DR_NEUTRAL_LOW) return "unfavorable";
    return "neutral";
  }

  return {
    drA: Math.round(drA * 100) / 100,
    drB: Math.round(drB * 100) / 100,
    levelA: classify(drA),
    levelB: classify(drB),
    labelA: DR_LABELS[classify(drA)],
    labelB: DR_LABELS[classify(drB)],
  };
}

// ─── M3 : Vulnérabilité 2nd Service ────────────────────────────────────────

export function computeSecondServeAlert(stats: LiveStatsSnapshot): SecondServeAlert {
  const p1 = safeNum(stats.p1_second_won, 50);
  const p2 = safeNum(stats.p2_second_won, 50);
  function lvl(p: number) { return p < SECOND_CRITICAL ? "critical" as const : p < SECOND_WARNING ? "warning" as const : "ok" as const; }
  const l1 = lvl(p1); const l2 = lvl(p2);
  const prio: Record<string, number> = { critical: 3, warning: 2, ok: 1 };
  if (prio[l1] >= prio[l2] && l1 !== "ok") return { player: "A", pct: p1, level: l1 };
  if (l2 !== "ok") return { player: "B", pct: p2, level: l2 };
  return { player: null, pct: 50, level: "ok" };
}

// ─── M4 : Exposition Break Points ──────────────────────────────────────────

export function computeBPExposure(stats: LiveStatsSnapshot): BPExposure {
  return {
    p1SavePct: stats.p1_bp_saved,
    p2SavePct: stats.p2_bp_saved,
  };
}

// ─── M6 : Hold Probability Live ─────────────────────────────────────────────

export function computeHoldProbability(holdPct: number, gameScore: string): number {
  const adj = HOLD_ADJ[gameScore] ?? 0;
  return clamp(Math.round(holdPct + adj), 2, 98);
}

// ─── M7 : Alerte Fatigue Composite ──────────────────────────────────────────

export function computeFatigueAlert(
  stats: LiveStatsSnapshot, dr: DrResult, isServingA: boolean,
): FatigueAlert {
  const player = isServingA ? "A" as const : "B" as const;
  const oppDR = isServingA ? dr.drB : dr.drA;
  const firstPct = isServingA ? safeNum(stats.p1_first_pct, 60) : safeNum(stats.p2_first_pct, 60);
  const avgFirst = 62; // moyenne ATP (TODO: historique joueur depuis DB)
  const drop = avgFirst - firstPct;

  if (drop > FIRST_DROP_CRIT && oppDR > DR_OPP_CRITICAL) {
    return { level: "break_imminent", player,
      message: `1ère balle en chute (-${Math.round(drop)}%) + adversaire dominant (DR ${oppDR.toFixed(2)}) — risque de break` };
  }
  if (drop > FIRST_DROP_WARN && oppDR > DR_OPP_PRESSURE) {
    return { level: "pressure", player,
      message: `Service sous pression (1ère à ${Math.round(firstPct)}%, DR adverse ${oppDR.toFixed(2)})` };
  }
  if (firstPct < 50) {
    return { level: "pressure", player,
      message: `1er service en difficulté (${Math.round(firstPct)}%)` };
  }
  return { level: "none", player: null, message: "" };
}

// ─── M5 : Dynamic Pressure Index ─────────────────────────────────────────

/**
 * Score composite de pression 0-100. Combine :
 *   - DR adverse (poids 40%)
 *   - Vulnérabilité 2nd service (poids 30%)
 *   - Exposition break points (poids 20%)
 *   - % 1ère balle absolu (poids 10%)
 *
 * > 65 = zone de danger pour le serveur, > 80 = break imminent probable.
 */
export function computePressureIndex(stats: LiveStatsSnapshot, dr: DrResult): number {
  // DR contribution : DR adv > 1 = pression sur nous
  const drAdv = Math.max(dr.drA, dr.drB);
  const drScore = Math.min(100, Math.round((drAdv - 0.7) * 60));

  // 2nd serve : plus bas = plus de pression
  const p1Second = safeNum(stats.p1_second_won, 50);
  const p2Second = safeNum(stats.p2_second_won, 50);
  const minSecond = Math.min(p1Second, p2Second);
  const secondScore = Math.min(100, Math.round((60 - minSecond) * 2));

  // BP saved : plus bas = plus de pression
  const minBP = Math.min(safeNum(stats.p1_bp_saved, 100), safeNum(stats.p2_bp_saved, 100));
  const bpScore = Math.min(100, Math.round((100 - minBP) * 1.2));

  // 1st serve : plus bas = plus de pression
  const minFirst = Math.min(safeNum(stats.p1_first_pct, 65), safeNum(stats.p2_first_pct, 65));
  const firstScore = Math.min(100, Math.round((65 - minFirst) * 1.5));

  return clamp(
    Math.round(drScore * 0.40 + secondScore * 0.30 + bpScore * 0.20 + firstScore * 0.10),
    0, 100,
  );
}

// ─── Agrégateur ─────────────────────────────────────────────────────────────

export function computeLiveMetrics(
  stats: LiveStatsSnapshot | null,
  options?: {
    holdPctA?: number | null;
    holdPctB?: number | null;
    gameScore?: string;
    server?: "A" | "B";
  },
): CalculatedLiveMetrics {
  const s: LiveStatsSnapshot = stats ?? {
    p1_aces: null, p2_aces: null, p1_df: null, p2_df: null,
    p1_first_pct: null, p2_first_pct: null,
    p1_first_won: null, p2_first_won: null,
    p1_second_won: null, p2_second_won: null,
    p1_bp_saved: null, p2_bp_saved: null,
  };
  const dr = computeDominanceRatio(s);
  return {
    dr,
    secondServeAlert: computeSecondServeAlert(s),
    bpExposure: computeBPExposure(s),
    holdProbA: options?.holdPctA != null ? computeHoldProbability(options.holdPctA, options.gameScore ?? "0-0") : null,
    holdProbB: options?.holdPctB != null ? computeHoldProbability(options.holdPctB, options.gameScore ?? "0-0") : null,
    fatigueAlert: computeFatigueAlert(s, dr, options?.server === "A"),
    pressureIndex: computePressureIndex(s, dr),
  };
}


