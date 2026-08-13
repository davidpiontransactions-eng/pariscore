/** Formatage strict des nombres — aucune valeur NaN/undefined ne sort d'ici. */

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 0.723 → "72,3 %" */
export function fmtPct(prob: number): string {
  if (!Number.isFinite(prob)) return "—";
  return `${(prob * 100).toFixed(1).replace(".", ",")} %`;
}

/** Probabilité → cote américaine (moneyline). */
export function americanOdds(prob: number): number {
  if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) return 0;
  return prob >= 0.5
    ? Math.round(-(100 * prob) / (1 - prob))
    : Math.round((100 * (1 - prob)) / prob);
}

/** 12.34 → "12,3" ; null → "—". */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${round1(n).toFixed(1).replace(".", ",")}`;
}

/** 7 → "7-3" pour un W-L ; null/donnée manquante → "—". */
export function fmtWinLoss(wins: number | null, losses: number | null): string {
  if (wins === null || losses === null || !Number.isFinite(wins) || !Number.isFinite(losses)) {
    return "—";
  }
  return `${wins}-${losses}`;
}
