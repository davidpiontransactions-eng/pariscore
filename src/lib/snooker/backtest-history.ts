// Backtest historique snooker — walk-forward Elo chronologique sur
// SnookerDB (CueTracker, 1907→2026).
//
// Méthodologie (honnêteté du produit) : on rejoue les matchs dans l'ordre
// chronologique avec un Elo (init 1500, K=24) pour produire, À CHAQUE match,
// la proba que le joueur 1 gagne — puis on compare aux résultats réels.
// Il n'y a PAS de cotes historiques gratuites pour le snooker → pas de ROI :
// on mesure accuracy / Brier / log-loss / calibration, et on compare au
// baseline « favori au classement » (table rankings de SnookerDB).

import type { SnookerBacktestRow, SnookerRankingRow } from "./snooker-history-db";

export type SnookerBtWindow = "full" | "d365" | "season";

export type SnookerBtSegment = {
  key: string;
  label: string;
  nMatches: number;
  accuracy: number;
  brier: number;
};

export type SnookerBtDimension = {
  key: string;
  label: string;
  segments: SnookerBtSegment[];
};

export type SnookerBtCalibration = {
  range: string;
  avgPredicted: number;
  actualRate: number;
  count: number;
};

export type SnookerBacktestResponse = {
  window: SnookerBtWindow;
  from: string;
  to: string;
  nMatches: number;
  source: "snookerdb";
  attribution: string;
  computedAt: string;
  metrics: { accuracy: number; brier: number; logLoss: number };
  baseline: { label: string; accuracy: number; n: number };
  calibration: SnookerBtCalibration[];
  dimensions: SnookerBtDimension[];
  error: string | null;
};

const ELO_INIT = 1500;
const ELO_K = 24;
const MIN_SEGMENT = 50;
const TOP_SEASONS = 15;

/** Saison snooker (juin→juillet) déduite d'une date ISO : "2026-03-01" → "2025-2026". */
export function seasonOfDate(isoDate: string): string {
  const year = parseInt(isoDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) return "";
  const month = parseInt(isoDate.slice(5, 7), 10);
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Bucket d'écart Elo (valeur absolue, avant le match). */
function eloGapBucket(gap: number): string {
  const g = Math.abs(gap);
  if (g < 50) return "<50";
  if (g < 100) return "50-99";
  if (g < 200) return "100-199";
  if (g < 400) return "200-399";
  return "400+";
}

/** Regroupement des tours pour la dimension stage. */
function stageBucket(stage: string): string {
  const s = stage.trim().toLowerCase();
  if (s === "final") return "Final";
  if (s.includes("semi")) return "Semi Final";
  if (s.includes("quarter") || s.includes("1/4")) return "Quarter Final";
  return "Autre";
}

type Agg = { n: number; correct: number; brierSum: number };

function pushAgg(map: Map<string, Agg>, key: string, correct: boolean, brier: number): void {
  const cur = map.get(key);
  if (cur) {
    cur.n++;
    cur.correct += correct ? 1 : 0;
    cur.brierSum += brier;
  } else {
    map.set(key, { n: 1, correct: correct ? 1 : 0, brierSum: brier });
  }
}

function toSegments(map: Map<string, Agg>, min = MIN_SEGMENT): SnookerBtSegment[] {
  return [...map.entries()]
    .filter(([, a]) => a.n >= min)
    .map(([key, a]) => ({
      key,
      label: key,
      nMatches: a.n,
      accuracy: round1((a.correct / a.n) * 100),
      brier: round3(a.brierSum / a.n),
    }))
    .sort((x, y) => y.nMatches - x.nMatches);
}

export function computeSnookerBacktest(
  rows: SnookerBacktestRow[],
  rankings: SnookerRankingRow[],
  opts: { window?: SnookerBtWindow } = {},
): SnookerBacktestResponse {
  const window: SnookerBtWindow = opts.window ?? "full";
  const attribution = "SnookerDB / CueTracker (GPL-3.0)";
  const base: SnookerBacktestResponse = {
    window,
    from: "",
    to: "",
    nMatches: 0,
    source: "snookerdb",
    attribution,
    computedAt: new Date().toISOString(),
    metrics: { accuracy: 0, brier: 0, logLoss: 0 },
    baseline: { label: "Favori au classement", accuracy: 0, n: 0 },
    calibration: [],
    dimensions: [],
    error: null,
  };

  if (rows.length === 0) return { ...base, error: "historique snooker vide" };

  // ── Tri chronologique + fenêtre ──────────────────────────────────────────
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const maxDate = sorted[sorted.length - 1].date;
  let selected = sorted;
  if (window === "d365") {
    const anchor = new Date(maxDate + "T00:00:00Z");
    anchor.setUTCDate(anchor.getUTCDate() - 365);
    const cutoff = anchor.toISOString().slice(0, 10);
    selected = sorted.filter((r) => r.date >= cutoff);
  } else if (window === "season") {
    const season = seasonOfDate(maxDate);
    selected = sorted.filter((r) => seasonOfDate(r.date) === season);
  }
  if (selected.length === 0) {
    return { ...base, error: `fenêtre "${window}" sans match` };
  }

  // ── Baseline : (season, player_url) → start_position ─────────────────────
  const rankMap = new Map<string, number>();
  for (const r of rankings) {
    if (r.start_position != null) rankMap.set(`${r.season}|${r.player_url}`, r.start_position);
  }

  // ── Walk-forward Elo ─────────────────────────────────────────────────────
  const elo = new Map<string, number>();
  const rating = (url: string, name: string): number =>
    elo.get(url) ?? elo.get(name) ?? ELO_INIT;

  let correct = 0;
  let brierSum = 0;
  let logSum = 0;
  let baseCorrect = 0;
  let baseN = 0;

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    min: 50 + i * 5,
    predSum: 0,
    correct: 0,
    n: 0,
  }));

  const dims: Record<string, Map<string, Agg>> = {
    season: new Map(),
    category: new Map(),
    stage: new Map(),
    bestOf: new Map(),
    eloGap: new Map(),
  };

  for (const m of selected) {
    const k1 = m.player_1_url || m.player_1;
    const k2 = m.player_2_url || m.player_2;
    const r1 = rating(k1, m.player_1);
    const r2 = rating(k2, m.player_2);
    const p1 = 1 / (1 + 10 ** (-(r1 - r2) / 400));
    const outcome = m.player_1_score > m.player_2_score ? 1 : 0;

    const predictedP1 = p1 >= 0.5;
    const isCorrect = predictedP1 === (outcome === 1);
    correct += isCorrect ? 1 : 0;
    const brier = (p1 - outcome) ** 2;
    brierSum += brier;
    const pred = outcome === 1 ? p1 : 1 - p1;
    if (pred > 0.01) logSum += -Math.log(pred);

    // Calibration (confiance du côté prédit, miroir de la route accuracy)
    const conf = p1 >= 0.5 ? p1 * 100 : (1 - p1) * 100;
    if (conf >= 50) {
      const b = buckets[Math.min(9, Math.max(0, Math.floor((conf - 50) / 5)))];
      b.n++;
      b.predSum += conf;
      if (isCorrect) b.correct++;
    }

    // Baseline favori au classement
    const season = seasonOfDate(m.date);
    const pos1 = rankMap.get(`${season}|${k1}`);
    const pos2 = rankMap.get(`${season}|${k2}`);
    if (pos1 != null && pos2 != null && pos1 !== pos2) {
      baseN++;
      const favIsP1 = pos1 < pos2;
      if (favIsP1 === (outcome === 1)) baseCorrect++;
    }

    pushAgg(dims.season, season, isCorrect, brier);
    if (m.category) pushAgg(dims.category, m.category, isCorrect, brier);
    pushAgg(dims.stage, stageBucket(m.stage), isCorrect, brier);
    pushAgg(dims.bestOf, `Bo${m.best_of}`, isCorrect, brier);
    pushAgg(dims.eloGap, eloGapBucket(r1 - r2), isCorrect, brier);

    // Mise à jour Elo (issue réelle)
    elo.set(k1, r1 + ELO_K * (outcome - p1));
    elo.set(k2, r2 + ELO_K * (p1 - outcome));
  }

  const n = selected.length;
  const calibration: SnookerBtCalibration[] = buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      range: `${b.min}-${b.min + 5}%`,
      avgPredicted: round1(b.predSum / b.n),
      actualRate: round1((b.correct / b.n) * 100),
      count: b.n,
    }));

  const seasonSegs = toSegments(dims.season).slice(0, TOP_SEASONS);

  return {
    window,
    from: selected[0].date,
    to: selected[selected.length - 1].date,
    nMatches: n,
    source: "snookerdb",
    attribution,
    computedAt: new Date().toISOString(),
    metrics: {
      accuracy: round1((correct / n) * 100),
      brier: round3(brierSum / n),
      logLoss: round3(logSum / n),
    },
    baseline: {
      label: "Favori au classement",
      accuracy: baseN > 0 ? round1((baseCorrect / baseN) * 100) : 0,
      n: baseN,
    },
    calibration,
    dimensions: [
      { key: "season", label: "Saison", segments: seasonSegs },
      { key: "category", label: "Catégorie", segments: toSegments(dims.category) },
      { key: "stage", label: "Tour (stage)", segments: toSegments(dims.stage) },
      { key: "bestOf", label: "Best of", segments: toSegments(dims.bestOf) },
      { key: "eloGap", label: "Écart Elo", segments: toSegments(dims.eloGap) },
    ],
    error: null,
  };
}
