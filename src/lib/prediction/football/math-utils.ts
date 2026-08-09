export const round2 = (x: number): number => Math.round(x * 100) / 100;
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export function normalizeMatrix(m: number[][]): number[][] {
  const sum = m.flat().reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) return m;
  return m.map((row) => row.map((v) => v / sum));
}