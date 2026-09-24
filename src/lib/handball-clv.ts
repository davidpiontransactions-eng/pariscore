// Devig + CLV handball — modèle vs cotes d'ouverture 1xbet (proxy).
// Réf : ImpliedScore/SportSignals (devig), CLV = (p_model − p_implied)/p_implied.
// TS pur, sans dépendance.

/** Edge affiché si |CLV| > 1,5 % (plan §4). */
export const CLV_EDGE_THRESHOLD = 0.015;
/** Seuil significativité par stratégie-ligue (en dessous = bruit). */
export const CLV_MIN_SAMPLE = 30;

// ─── Devig ───

/** Devig proportionnel : (1/cote) ÷ booksum. */
export function devigProportional(odds: number[]): number[] {
  const inv = odds.map((o) => (o != null && o > 1 ? 1 / o : 0));
  const booksum = inv.reduce((a, b) => a + b, 0);
  if (booksum <= 0) return odds.map(() => 0);
  return inv.map((q) => q / booksum);
}

/** Prob implicite brute (cote unique : marge incluse, pas de booksum). */
export function rawImplied(odds: number): number {
  return odds != null && odds > 1 ? 1 / odds : 0;
}

export type ShinResult = {
  probs: number[];
  /** Paramètre Shin z (0 = pas de biais favori) */
  z: number;
  /** Note si résidu favori détecté (biais longshot-favori) */
  note?: string;
};

/**
 * Devig Shin optionnel (plan §4) : corrige le biais favori-outsider.
 * Modèle balanced-book : outsiders (1−z) répartis selon les probas vraies,
 * initiés (z) tout sur le vainqueur, book équilibré →
 *   p_i = (δ_i·C − z) / (1−z), C = (1 + z·(n−1)) / Σδ, δ_i = 1/cote.
 * z exogène (fraction d'initiés, défaut 0.02 typique) : le point fixe
 * endogène z = Σπ²/2 ne normalise pas (Σ≠1 constaté numériquement).
 * Σ = 1 exact par construction ; favori ↑, outsider ↓ vs proportionnel.
 */
export function devigShin(odds: number[], z = 0.02): ShinResult {
  const raw = odds.map((o) => (o != null && o > 1 ? 1 / o : 0));
  if (raw.every((q) => q === 0)) return { probs: raw, z };
  const booksum = raw.reduce((a, b) => a + b, 0);
  const n = raw.length;
  const zz = Math.min(0.5, Math.max(0, z));
  const C = (1 + zz * (n - 1)) / booksum;
  let probs = raw.map((d) => (d * C - zz) / (1 - zz));
  // Garde-fous numériques (cotes extrêmes) : clamp + renormalisation
  if (probs.some((p) => !(p >= 0))) {
    probs = probs.map((p) => Math.max(p, 0));
    const t = probs.reduce((a, b) => a + b, 0);
    probs = t > 0 ? probs.map((p) => p / t) : devigProportional(odds);
  }
  const prop = devigProportional(odds);
  // Résidu favori : Shin déplace le favori de ≥ 0,5 pp vs proportionnel
  let favShift = 0;
  for (let i = 0; i < probs.length; i++) {
    favShift = Math.max(favShift, Math.abs(probs[i] - prop[i]));
  }
  const note =
    favShift >= 0.005
      ? `Biais favori-outsider détecté (Shin z=${z.toFixed(3)}, décalage max ${(favShift * 100).toFixed(1)} pp)`
      : undefined;
  return { probs, z: zz, note };
}

// ─── CLV ───

/** CLV = (p_model − p_implied) / p_implied, par marché. */
export function clvValue(pModel: number, pImplied: number): number {
  if (!(pImplied > 0)) return 0;
  return (pModel - pImplied) / pImplied;
}

/** Edge affiché : |CLV| > 1,5 %. */
export function isClvEdge(clv: number): boolean {
  return Math.abs(clv) > CLV_EDGE_THRESHOLD;
}

// ─── Agrégation ───

export type ClvRecord = {
  /** CLV signé de l'observation */
  clv: number;
  /** Pari gagné (règlement score final) */
  win: boolean;
  /** Cote d'ouverture jouée (profit flat 1u) */
  odds: number;
};

export type ClvSummary = {
  nBets: number;
  meanCLV: number | null;
  stdCLV: number | null;
  hitRate: number | null;
  profitSimU: number;
  roiPct: number | null;
};

/** Métriques CLV : meanCLV, stdCLV (échantillon), hit-rate, profit simulé flat 1u. */
export function summarizeClv(records: ClvRecord[]): ClvSummary {
  const n = records.length;
  if (n === 0) {
    return { nBets: 0, meanCLV: null, stdCLV: null, hitRate: null, profitSimU: 0, roiPct: null };
  }
  const mean = records.reduce((a, r) => a + r.clv, 0) / n;
  let variance = 0;
  if (n > 1) {
    variance = records.reduce((a, r) => a + (r.clv - mean) * (r.clv - mean), 0) / (n - 1);
  }
  const wins = records.filter((r) => r.win).length;
  let profit = 0;
  for (const r of records) profit += r.win ? r.odds - 1 : -1;
  profit = Math.round(profit * 100) / 100;
  return {
    nBets: n,
    meanCLV: mean,
    stdCLV: n > 1 ? Math.sqrt(variance) : 0,
    hitRate: wins / n,
    profitSimU: profit,
    roiPct: (profit / n) * 100,
  };
}
