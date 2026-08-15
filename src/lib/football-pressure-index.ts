// Pressure Index — moteur de la timeline momentum football.
//
// Buckets de 5 min : pour chaque bucket b, on combine les deltas
// (home − away) de 4 signaux micro-intensité :
//
//   M_b = w1·Δdanger_b + w2·Δcorners_b + w3·ΔSOT_b + w4·ΔxG_b
//   w   = { danger: 0.35, corners: 0.20, sot: 0.25, xg: 0.20 }
//
// Les Δ sont ramenés à une échelle stable (danger 0..100, corners/tirs par
// bucket, xG par bucket), sommation pondérée puis `tanh` → [-100, +100].
//
// Recalibrage BSD (`reconcile`) : quand un momentum BSD minute-par-minute
// existe (endpoint /v2/events/{id}/stats/), on le rééchantillonne aux centres
// de buckets et on blend :  final = 0.55·M_b + 0.45·m_bsd_b.
//
// Fallback (ligues non couvertes en données par minute) : une courbe lissée
// calibrée sur les totaux (possession + corners), `layers.perMinute = false`.

import type {
  DangerousBucket,
  MatchEvent,
  MatchTimelineData,
  MomentumTimePoint,
  TimelineTotals,
} from "./football-timeline";
import { toArr } from "./football-timeline";

// ─── Réglages moteur ────────────────────────────────────────────────────────

export const PRESSURE_WEIGHTS = {
  danger: 0.35,
  corners: 0.2,
  sot: 0.25,
  xg: 0.2,
} as const;

const BUCKET_MIN = 5;
/** Échelles de delta par signal (par bucket) avant pondération. */
const DANGER_SCALE = 10;
const CORNERS_SCALE = 3;
const SOT_SCALE = 6;
const XG_SCALE = 0.4;
/** Gain post-tanh pour saturer proche de ±100 sous forte domination. */
const TANH_GAIN = 2.0;
/** Seuil de divergence (valeur) pour le calcul du % de dominance. */
const DOMINANCE_THRESHOLD = 5;
const FALLBACK_BUCKETS = 18; // 90' / 5

// ─── Input type ─────────────────────────────────────────────────────────────

/** Contribution d'un bucket de 5 min (home/away). */
export interface PressureBucketInput {
  /** Début du bucket (multiple de 5 : 0 | 5 | …). */
  start: number;
  /** Indice d'attaques dangereuses 0..100 par camp (proxy dérivé). */
  danger: { home: number; away: number };
  /** Corners obtenus dans le bucket. */
  corners?: { home: number; away: number };
  /** Tirs cadrés dans le bucket (proxy : SOT). */
  sot?: { home: number; away: number };
  /** xG cumulé dans le bucket (source BSD habituellement). */
  xg?: { home: number; away: number };
}

export interface PressureTimelineInput {
  /** Buckets dérivés (ESPN commentary / BSD xG). Vide → fallback courbe. */
  buckets: PressureBucketInput[];
  /** Événements timeline (buts typiquement). */
  events: MatchEvent[];
  /** Anchor BSD : momentum minute-par-minute optionnel (reconcile). */
  bsdMomentum?: { minute: number; value: number }[];
  /** Totaux match — utilisé pour la courbe lissée du fallback. */
  totals?: TimelineTotals;
  source: "bsd" | "espn" | "bsd+espn";
  /** Minute courante (live) — clamp la longueur de la courbe. */
  finalMinute?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number, lo = -Infinity, hi = Infinity): number {
  return Math.max(lo, Math.min(hi, n));
}

function howValue(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Δ normalisé d'une série par-bucket → échelle ~[-1, 1]. */
function delta(raw: number, scale: number): number {
  return clamp(raw / (scale || 1), -3, 3);
}

/** Score cumulative (chronologique) injectée sur chaque but. */
function withLiveScore(events: MatchEvent[]): MatchEvent[] {
  let home = 0;
  let away = 0;
  return [...events]
    .sort((a, b) => a.minute - b.minute)
    .map((e) => {
      if (e.kind !== "goal") return e;
      if (e.side === "home") home += 1;
      else if (e.side === "away") away += 1;
      return { ...e, score: { home, away } };
    });
}

/** Mini-histogramme danger 0..100 (normalisé sur le max du match). */
function dangerBars(buckets: PressureBucketInput[]): DangerousBucket[] {
  const scaled = buckets
    .filter((b) => b && Number.isFinite(b.start))
    .map((b) => {
      const home = howValue(b.danger?.home);
      const away = howValue(b.danger?.away);
      return { start: b.start, home, away };
    });
  let max = 0;
  for (const s of scaled) max = Math.max(max, s.home, s.away);
  if (max <= 0) return scaled.map((s) => ({ start: s.start, home: 0, away: 0 }));
  return scaled.map((s) => ({
    start: s.start,
    home: Math.round((s.home / max) * 100),
    away: Math.round((s.away / max) * 100),
  }));
}

/** Moyenne du momentum BSD sur la plage [start, start+5). */
function bsdAvgFor(bsd: { minute: number; value: number }[], start: number): number | null {
  const hits = bsd.filter((p) => {
    const m = howValue(p.minute);
    return m >= start && m < start + BUCKET_MIN;
  });
  if (!hits.length) return null;
  const sum = hits.reduce((acc, p) => acc + howValue(p.value), 0);
  return sum / hits.length;
}

/** Valeur M_b : somme pondérée des Δ puis tanh → [-100, +100]. */
export function bucketMomentum(b: PressureBucketInput): number {
  const dDanger = howValue(b.danger?.home) - howValue(b.danger?.away);
  const dXg = howValue(b.xg?.home) - howValue(b.xg?.away);
  const dCorners = howValue(b.corners?.home) - howValue(b.corners?.away);
  const dSot = howValue(b.sot?.home) - howValue(b.sot?.away);

  const raw =
    PRESSURE_WEIGHTS.danger * delta(dDanger, DANGER_SCALE) +
    PRESSURE_WEIGHTS.corners * delta(dCorners, CORNERS_SCALE) +
    PRESSURE_WEIGHTS.sot * delta(dSot, SOT_SCALE) +
    PRESSURE_WEIGHTS.xg * delta(dXg, XG_SCALE);

  return clamp(Math.round(Math.tanh(raw * TANH_GAIN) * 100), -100, 100);
}

/** Courbe lissée calibrée sur les totaux (fallback ligues mineures). */
export function fallbackCurve(totals: TimelineTotals | undefined, buckets = FALLBACK_BUCKETS): MomentumTimePoint[] {
  const possession = totals?.possession ?? { home: 50, away: 50 };
  const corners = totals?.corners ?? { home: 0, away: 0 };

  const possDiff = clamp(howValue(possession.home) - howValue(possession.away), -100, 100) / 100;
  const cornTotal = howValue(corners.home) + howValue(corners.away);
  const cornDiff = cornTotal > 0 ? clamp((howValue(corners.home) - howValue(corners.away)) / cornTotal, -1, 1) : 0;
  const dir = clamp(0.6 * possDiff + 0.4 * cornDiff, -1, 1);

  const amp = 60;
  const pts: MomentumTimePoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const t = i / Math.max(1, buckets - 1);
    // Enveloppe triangulaire 0→1→0 (neutralité aux extrémités du match).
    const env = Math.min(t * 2, (1 - t) * 2);
    // Oscillation sinusoïdale : 1.5 période — courbe "lissée" non plate.
    const osc = 0.5 + 0.5 * Math.cos((t * Math.PI * 3) / 1);
    const value = clamp(Math.round(dir * amp * env * (0.45 + 0.55 * osc)), -100, 100);
    pts.push({
      minute: i * BUCKET_MIN + BUCKET_MIN / 2,
      value,
      homePressure: clamp(Math.round(50 + value / 2), 0, 100),
      awayPressure: clamp(Math.round(50 - value / 2), 0, 100),
    });
  }
  return pts;
}

// ─── API principale ─────────────────────────────────────────────────────────

/**
 * Assemble la timeline de momentum/pression d'un match à partir de buckets
 * micro-intensité + événements + anchor BSD optionnel (reconcile).
 */
export function buildPressureTimeline(input: PressureTimelineInput): MatchTimelineData {
  const buckets = toArr<PressureBucketInput>(input.buckets).filter(
    (b): b is PressureBucketInput => !!b && Number.isFinite(b.start),
  );
  const events = withLiveScore(
    toArr<MatchEvent>(input.events).filter(
      (e): e is MatchEvent => !!e && (e.kind === "goal" || e.kind === "corner") && Number.isFinite(e.minute),
    ),
  );
  const bsd = toArr<{ minute: number; value: number }>(input.bsdMomentum).filter(
    (p): p is { minute: number; value: number } => !!p && Number.isFinite(p.minute) && Number.isFinite(p.value),
  );
  const finalMinute = clamp(howValue(input.finalMinute) || 90, 5, 120);
  const source = input.source;

  // A-t-on la moindre donnée par minute (autre que l'anchor seul) ?
  const hasPerMinuteSignals = buckets.some((b) => {
    return (
      Math.abs(howValue(b.danger?.home) - howValue(b.danger?.away)) > 1e-6 ||
      Math.abs(howValue(b.corners?.home) - howValue(b.corners?.away)) > 1e-6 ||
      Math.abs(howValue(b.sot?.home) - howValue(b.sot?.away)) > 1e-6 ||
      Math.abs(howValue(b.xg?.home) - howValue(b.xg?.away)) > 1e-6
    );
  });

  let momentum: MomentumTimePoint[];
  let perMinute: boolean;

  if (hasPerMinuteSignals) {
    // Courbe moteur : centres de buckets (0..maxStart), blend avec anchor BSD.
    const maxStart = buckets.reduce((mx, b) => Math.max(mx, b.start + BUCKET_MIN), 0);
    const points: MomentumTimePoint[] = [];
    for (let start = 0; start < maxStart; start += BUCKET_MIN) {
      const b = buckets.find((x) => x.start === start);
      const m = b ? bucketMomentum(b) : 0;
      const anchor = bsd.length ? bsdAvgFor(bsd, start) : null;
      const value = bsd.length ? Math.round(0.55 * m + 0.45 * (anchor ?? m)) : m;
      const center = start + BUCKET_MIN / 2;
      if (center > finalMinute) break;
      points.push({
        minute: center,
        value: clamp(value, -100, 100),
        homePressure: clamp(Math.round(50 + value / 2), 0, 100),
        awayPressure: clamp(Math.round(50 - value / 2), 0, 100),
      });
    }
    momentum = points;
    perMinute = true;
  } else if (bsd.length > 0) {
    // Anchor BSD seul : courbe = moyennes par bucket du momentum BSD.
    const maxMinute = bsd.reduce((mx, p) => Math.max(mx, howValue(p.minute)), 0);
    const points: MomentumTimePoint[] = [];
    for (let start = 0; start <= maxMinute; start += BUCKET_MIN) {
      const avg = bsdAvgFor(bsd, start) ?? 0;
      const center = start + BUCKET_MIN / 2;
      if (center > finalMinute) break;
      points.push({
        minute: center,
        value: clamp(Math.round(avg), -100, 100),
        homePressure: clamp(Math.round(50 + avg / 2), 0, 100),
        awayPressure: clamp(Math.round(50 - avg / 2), 0, 100),
      });
    }
    momentum = points;
    perMinute = true;
  } else {
    // Fallback : courbe lissée calibrée sur les totaux.
    momentum = fallbackCurve(input.totals);
    perMinute = false;
  }

  // Pression : % du temps où chaque camp domine (signe du momentum).
  const homeDominant = momentum.filter((p) => p.value > DOMINANCE_THRESHOLD).length;
  let homePct = 50;
  let awayPct = 50;
  if (momentum.length) {
    homePct = Math.round((homeDominant / momentum.length) * 100);
    awayPct = 100 - homePct;
  }

  return {
    momentum,
    events,
    xgPerMinute: buckets
      .map((b) => ({
        minute: b.start,
        home: Math.round(howValue(b.xg?.home) * 100) / 100,
        away: Math.round(howValue(b.xg?.away) * 100) / 100,
      }))
      .filter((p) => p.home > 0 || p.away > 0),
    dangerous: dangerBars(buckets),
    pressure: { homePct, awayPct },
    layers: {
      goals: events.some((e) => e.kind === "goal"),
      corners: events.some((e) => e.kind === "corner") || buckets.some((b) => howValue(b.corners?.home) + howValue(b.corners?.away) > 0),
      dangerous: buckets.some((b) => howValue(b.danger?.home) + howValue(b.danger?.away) > 0),
      perMinute,
    },
    source,
  };
}
