// Moteur CMP (Conway-Maxwell-Poisson) — totaux handball.
// Réf : Felice & Ley doi:10.1177/22150218251313937 (SEL), handball sous-dispersé (ν > 1).
// TS pur, sans dépendance.
//
// P(k; λ, ν) = λ^k / (k!)^ν / Z(λ, ν), Z = Σ_j λ^j / (j!)^ν.
// (Forme plan e^(−λ)/Z équivalente après normalisation ; ν=1 → Poisson exact.)
// Grille adaptative (plancher 17, cf. plan 17×17) : les lignes handball
// (55.5/62.5) exigent i,j jusqu'à ~63 — grille fixe 17×17 inutilisable.

/** λ neutre (buts/équipe/match handball ~57/2) quand l'historique manque. */
export const CMP_NEUTRAL_LAMBDA = 28.5;
/** ν par défaut (sous-dispersion handball, miroir CMP_NU stratégie-top8). */
export const CMP_DEFAULT_NU = 1.3;
/** Historique minimal pour un fit Newton (en dessous = repli moyenne). */
export const CMP_MIN_HISTORY = 3;
/** Fenêtre d'historique (5–10 derniers matchs, plan §2). */
export const CMP_HISTORY_WINDOW = 10;

// ─── Factorielle log (cache) ───

const LOGFACT: number[] = [0]; // LOGFACT[k] = ln(k!)

function logFact(k: number): number {
  for (let i = LOGFACT.length; i <= k; i++) LOGFACT.push(LOGFACT[i - 1] + Math.log(i));
  return LOGFACT[k];
}

// ─── Grille ───

/**
 * Borne sup de grille : plancher 17 (plan), étendue à λ + 8σ et à la ligne
 * jouée (sinon P(total>L) tronquée).
 */
export function cmpKMax(lambda: number, line = 0): number {
  const spread = Math.ceil(lambda + 8 * Math.sqrt(Math.max(lambda, 0.05)));
  return Math.max(17, spread, Math.ceil(line));
}

// ─── PMF ───

/** PMF CMP normalisée sur 0..kMax (Σ = 1 par construction). */
export function cmpPmf(lambda: number, nu: number, kMax?: number): number[] {
  const lam = Math.max(lambda, 1e-6);
  const n = Math.max(nu, 1e-6);
  const k = kMax ?? cmpKMax(lam);
  const logL = Math.log(lam);
  const ws = new Array<number>(k + 1);
  let wMax = -Infinity;
  for (let j = 0; j <= k; j++) {
    const w = j * logL - n * logFact(j);
    ws[j] = w;
    if (w > wMax) wMax = w;
  }
  let z = 0;
  for (let j = 0; j <= k; j++) z += Math.exp(ws[j] - wMax);
  const logZ = Math.log(z) + wMax;
  return ws.map((w) => Math.exp(w - logZ));
}

// ─── Fit MLE Newton-Raphson ───

export type CmpFit = {
  lambda: number;
  nu: number;
  /** Taille d'échantillon */
  n: number;
  /** Newton convergé (sinon repli moyenne/ν défaut) */
  converged: boolean;
};

/** Poids récence par défaut : décroissance exponentielle 0.9 (dernier = 1). */
function defaultWeights(n: number): number[] {
  const w = new Array<number>(n);
  for (let i = 0; i < n; i++) w[i] = Math.pow(0.9, n - 1 - i);
  return w;
}

function modelMoments(lambda: number, nu: number): { mean: number; meanLogFact: number } {
  const kMax = Math.min(400, Math.ceil(lambda + 10 * Math.sqrt(Math.max(lambda, 0.05))) + 5);
  const pmf = cmpPmf(lambda, nu, kMax);
  let mean = 0;
  let mlf = 0;
  for (let j = 0; j <= kMax; j++) {
    mean += j * pmf[j];
    mlf += logFact(j) * pmf[j];
  }
  return { mean, meanLogFact: mlf };
}

/** E[X] du modèle (contrôle d'ajustement du fit). */
export function cmpMean(lambda: number, nu: number): number {
  return modelMoments(lambda, nu).mean;
}

/**
 * Fit CMP par MLE (Newton-Raphson maison sur les équations de score) :
 *   E_θ[X] = moyenne pondérée, E_θ[ln(X!)] = moyenne pondérée des ln(x!).
 * Espace (ln λ, ln ν) = positivité garantie. Repli moyenne/ν=1.3 si échec.
 */
export function fitCMP(goals: number[], weights?: number[]): CmpFit {
  const xs = goals.filter((x) => Number.isFinite(x) && x >= 0);
  const n = xs.length;
  if (n === 0) return { lambda: CMP_NEUTRAL_LAMBDA, nu: CMP_DEFAULT_NU, n: 0, converged: false };
  const w = weights && weights.length === n ? weights : defaultWeights(n);
  let wSum = 0;
  let mean = 0;
  let meanLf = 0;
  for (let i = 0; i < n; i++) {
    wSum += w[i];
    mean += w[i] * xs[i];
    meanLf += w[i] * logFact(Math.round(xs[i]));
  }
  if (wSum <= 0) return { lambda: CMP_NEUTRAL_LAMBDA, nu: CMP_DEFAULT_NU, n, converged: false };
  mean /= wSum;
  meanLf /= wSum;
  if (n < CMP_MIN_HISTORY || mean <= 0) {
    return { lambda: Math.max(mean, 0.05), nu: CMP_DEFAULT_NU, n, converged: false };
  }

  // Newton 2D en (a=lnλ, b=lnν)
  // ν borné [0.5, 3] : le système (moyenne, E[ln X!]) est en ridge pour
  // grands λ — sans borne, le bruit d'échantillonnage (5–10 matchs en prod)
  // projette ν vers des extrêmes ; λ suit la moyenne (moment 1 robuste).
  let a = Math.log(Math.max(mean, 0.05));
  let b = Math.log(1);
  const A_MIN = Math.log(0.05);
  const A_MAX = Math.log(200);
  const B_MIN = Math.log(0.5);
  const B_MAX = Math.log(3);
  const H = 1e-5;
  let converged = false;
  for (let iter = 0; iter < 50; iter++) {
    const lam = Math.exp(a);
    const nu = Math.exp(b);
    const m0 = modelMoments(lam, nu);
    const g1 = m0.mean - mean;
    const g2 = m0.meanLogFact - meanLf;
    if (Math.abs(g1) < 1e-10 * Math.max(1, mean) && Math.abs(g2) < 1e-10) {
      converged = true;
      break;
    }
    const mA1 = modelMoments(Math.exp(a + H), nu);
    const mA0 = modelMoments(Math.exp(a - H), nu);
    const mB1 = modelMoments(lam, Math.exp(b + H));
    const mB0 = modelMoments(lam, Math.exp(b - H));
    const j11 = (mA1.mean - mA0.mean) / (2 * H);
    const j12 = (mB1.mean - mB0.mean) / (2 * H);
    const j21 = (mA1.meanLogFact - mA0.meanLogFact) / (2 * H);
    const j22 = (mB1.meanLogFact - mB0.meanLogFact) / (2 * H);
    const det = j11 * j22 - j12 * j21;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const da = (j22 * g1 - j12 * g2) / det;
    const db = (-j21 * g1 + j11 * g2) / det;
    // Pas amorti (demi-pas si divergence)
    let step = 1;
    let improved = false;
    for (let halving = 0; halving < 8; halving++) {
      const na = Math.min(A_MAX, Math.max(A_MIN, a - step * da));
      const nb = Math.min(B_MAX, Math.max(B_MIN, b - step * db));
      const nm = modelMoments(Math.exp(na), Math.exp(nb));
      const n1 = nm.mean - mean;
      const n2 = nm.meanLogFact - meanLf;
      if (n1 * n1 + n2 * n2 < g1 * g1 + g2 * g2) {
        a = na;
        b = nb;
        improved = true;
        break;
      }
      step /= 2;
    }
    if (!improved) break;
  }
  const lambda = Math.exp(a);
  const nu = Math.exp(b);
  if (!Number.isFinite(lambda) || !Number.isFinite(nu)) {
    return { lambda: Math.max(mean, 0.05), nu: CMP_DEFAULT_NU, n, converged: false };
  }
  return { lambda, nu, n, converged };
}

// ─── Forces équipe (Felice SEL) ───

export type CmpTeam = {
  attack: CmpFit;
  defense: CmpFit;
  /** s_a = ln(λa) */
  sA: number;
  /** s_d = −ln(λd) */
  sD: number;
};

/**
 * Forces attaque/défense : fit CMP sur buts marqués (λa) et encaissés (λd),
 * fenêtre = 10 derniers (plan §2 : 5–10 pondérés).
 */
export function teamStrength(scored: number[], conceded: number[], weights?: number[]): CmpTeam {
  const s = scored.slice(-CMP_HISTORY_WINDOW);
  const c = conceded.slice(-CMP_HISTORY_WINDOW);
  const attack = fitCMP(s, weights ? weights.slice(-s.length) : undefined);
  const defense = fitCMP(c, weights ? weights.slice(-c.length) : undefined);
  return {
    attack,
    defense,
    sA: Math.log(Math.max(attack.lambda, 1e-6)),
    sD: -Math.log(Math.max(defense.lambda, 1e-6)),
  };
}

export type MatchLambdas = { lambdaH: number; lambdaE: number; nuH: number; nuE: number };

/**
 * Buts attendus du match : moyenne arithmétique attaque/défense
 * (convention codebase : expectedTotal/realExpectedTotal en (GF+GA)/2).
 */
export function matchLambdas(home: CmpTeam, away: CmpTeam): MatchLambdas {
  return {
    lambdaH: (home.attack.lambda + away.defense.lambda) / 2,
    lambdaE: (away.attack.lambda + home.defense.lambda) / 2,
    nuH: (home.attack.nu + away.defense.nu) / 2,
    nuE: (away.attack.nu + home.defense.nu) / 2,
  };
}

// ─── Over/Under ───

/** P(total > line) sur pmfs pré-calculées (réutilisé par le scan de lignes). */
export function totalOverProb(pmfH: number[], pmfA: number[], line: number): number {
  const kH = pmfH.length - 1;
  const kA = pmfA.length - 1;
  let under = 0;
  const iMax = Math.min(kH, Math.floor(line));
  for (let i = 0; i <= iMax; i++) {
    const pi = pmfH[i];
    if (pi === 0) continue;
    const jMax = Math.min(kA, Math.floor(line - i));
    let inner = 0;
    for (let j = 0; j <= jMax; j++) inner += pmfA[j];
    under += pi * inner;
  }
  return Math.min(1, Math.max(0, 1 - under));
}

/** P(total > L) = 1 − Σ_{i+j ≤ L} P(i)P(j) (indépendance conditionnelle). */
export function overUnderProb(
  lambdaH: number,
  nuH: number,
  lambdaE: number,
  nuE: number,
  line: number,
): { over: number; under: number } {
  const kMax = Math.max(cmpKMax(lambdaH, line), cmpKMax(lambdaE, line));
  const pmfH = cmpPmf(lambdaH, nuH, kMax);
  const pmfA = cmpPmf(lambdaE, nuE, kMax);
  const over = totalOverProb(pmfH, pmfA, line);
  return { over, under: 1 - over };
}
