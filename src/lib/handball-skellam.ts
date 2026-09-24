// Moteur Skellam — handicap handball (écart de buts).
// Réf : Karlis 2026 (différence de deux Poisson), λh/λe issus du CMP.
// P(k) = e^(−(λh+λe)) · (λh/λe)^(k/2) · I_k(2√(λh·λe)).
// TS pur, sans dépendance.

// ─── Bessel I_k (série, espace log) ───

const SKELLAM_LOGFACT: number[] = [0];

function skLogFact(k: number): number {
  for (let i = SKELLAM_LOGFACT.length; i <= k; i++) {
    SKELLAM_LOGFACT.push(SKELLAM_LOGFACT[i - 1] + Math.log(i));
  }
  return SKELLAM_LOGFACT[k];
}

/**
 * ln I_k(z) par série I_k(z) = Σ_m (z/2)^(2m+k) / (m!(m+k)!),
 * log-sum-exp (stable pour z ~ 60, handball λ ~ 29).
 */
function logBesselI(k: number, z: number): number {
  const kk = Math.abs(Math.round(k));
  const logHalfZ = Math.log(Math.max(z / 2, 1e-300));
  const terms: number[] = [];
  for (let m = 0; m < 500; m++) {
    const t = (2 * m + kk) * logHalfZ - skLogFact(m) - skLogFact(m + kk);
    terms.push(t);
    // Arrêt quand le terme s'effondre après le pic
    if (m > kk + z && t < terms[0] - 50) break;
  }
  let mx = -Infinity;
  for (const t of terms) if (t > mx) mx = t;
  let s = 0;
  for (const t of terms) s += Math.exp(t - mx);
  return mx + Math.log(s);
}

// ─── PMF Skellam ───

export type SkellamPmf = {
  /** Plus petit k couvert */
  kMin: number;
  /** probs[i] = P(kMin + i) */
  probs: number[];
};

/** Demi-largeur : couvre λ ± marge (queues < 1e-9). */
export function skellamKMax(lambdaH: number, lambdaE: number): number {
  const spread = Math.ceil(Math.max(lambdaH, lambdaE) + 10 * Math.sqrt(lambdaH + lambdaE));
  return Math.max(17, spread);
}

/** P(diff = k) pour k ∈ [−K, K], normalisée (Σ = 1). */
export function skellamPmf(lambdaH: number, lambdaE: number, kMax?: number): SkellamPmf {
  const lh = Math.max(lambdaH, 1e-6);
  const le = Math.max(lambdaE, 1e-6);
  const K = kMax ?? skellamKMax(lh, le);
  const z = 2 * Math.sqrt(lh * le);
  const logRatio = Math.log(lh / le);
  const base = -(lh + le);
  const probs = new Array<number>(2 * K + 1);
  for (let idx = 0; idx <= 2 * K; idx++) {
    const k = idx - K;
    const logP = base + (k / 2) * logRatio + logBesselI(k, z);
    probs[idx] = Math.exp(logP);
  }
  // Normalisation sur la grille (queues négligeables par construction)
  let s = 0;
  for (const p of probs) s += p;
  if (s > 0) for (let i = 0; i < probs.length; i++) probs[i] /= s;
  return { kMin: -K, probs };
}

/** P(diff = k) ponctuelle (pratique tests). */
export function skellamProb(lambdaH: number, lambdaE: number, k: number): number {
  const { kMin, probs } = skellamPmf(lambdaH, lambdaE, Math.max(17, Math.abs(k) + 4));
  const idx = Math.round(k) - kMin;
  return idx >= 0 && idx < probs.length ? probs[idx] : 0;
}

// ─── Handicap & 1X2 ───

export type HandicapProbs = {
  /** P(home − away > line) — couvre le handicap */
  home: number;
  /** P(away − home > line) */
  away: number;
};

/**
 * P(home−away > 4.5) = Σ_{k≥5} P(k) (plan §3).
 * away symétrique : P(diff < −line).
 */
export function handicapProb(lambdaH: number, lambdaE: number, line = 4.5): HandicapProbs {
  const { kMin, probs } = skellamPmf(lambdaH, lambdaE);
  let home = 0;
  let away = 0;
  for (let i = 0; i < probs.length; i++) {
    const k = kMin + i;
    if (k > line) home += probs[i];
    else if (k < -line) away += probs[i];
  }
  return { home, away };
}

export type Match1x2 = { home: number; draw: number; away: number };

/** Probs 1X2 équitables depuis la loi de l'écart (forces CMP). */
export function skellamMatchProbs(lambdaH: number, lambdaE: number): Match1x2 {
  const { kMin, probs } = skellamPmf(lambdaH, lambdaE);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let i = 0; i < probs.length; i++) {
    const k = kMin + i;
    if (k > 0) home += probs[i];
    else if (k < 0) away += probs[i];
    else draw += probs[i];
  }
  return { home, draw, away };
}

/**
 * Cohérence CMP↔Skellam (contrôle) : P(couvrir) par convolution directe
 * des pmfs marginales — même valeur que handicapProb à la grille près.
 */
export function handicapProbDirect(
  pmfH: number[],
  pmfA: number[],
  line = 4.5,
): HandicapProbs {
  // Convolution générique sur pmfs déjà normalisées.
  let home = 0;
  let away = 0;
  for (let i = 0; i < pmfH.length; i++) {
    if (pmfH[i] === 0) continue;
    for (let j = 0; j < pmfA.length; j++) {
      const d = i - j;
      if (d > line) home += pmfH[i] * pmfA[j];
      else if (d < -line) away += pmfH[i] * pmfA[j];
    }
  }
  return { home, away };
}
