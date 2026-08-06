export const KELLY_FRACTION_CAP = 0.25;

export type KellyResult = { pct: number; capped: boolean };

/**
 * % de mise Kelly (fractional) : f* = (p * b - q) / b, avec
 * p = proba de victoire [0-1], b = cote nette (cote - 1), q = 1 - p.
 * Aligné sur `_kelly_criterion` de src/strategies/engine.py :
 *  - retour 0 si EV <= 0 (ne pas parier),
 *  - cap à 0.25 (fractional Kelly) matérialisé par `capped`.
 */
export function computeKellyStake(pct: number, decimal: number): KellyResult {
  if (decimal <= 1) return { pct: 0, capped: false };
  const p = Math.max(0, Math.min(1, pct / 100));
  const b = decimal - 1;
  const q = 1 - p;
  const f = (p * b - q) / b;
  if (f <= 0) return { pct: 0, capped: false };
  if (f >= KELLY_FRACTION_CAP) return { pct: KELLY_FRACTION_CAP * 100, capped: true };
  return { pct: f * 100, capped: false };
}