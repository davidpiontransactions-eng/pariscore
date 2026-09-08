import { describe, expect, test } from "bun:test";
import { scoreMatrixForMatch } from "@/lib/besoccer-matrix";

describe("scoreMatrixForMatch", () => {
  test("matrice 11x11, somme ≈ 1, favori gagne", () => {
    const r = scoreMatrixForMatch({ homeOdds: 1.5, drawOdds: 4.0, awayOdds: 6.0 });
    expect(r.matrix).toHaveLength(11);
    expect(r.matrix[0]).toHaveLength(11);
    const sum = r.matrix.flat().reduce((a, c) => a + c.prob, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThanOrEqual(1.001);
    expect(r.homeWin).toBeGreaterThan(0.5);
    expect(r.awayWin).toBeLessThan(r.homeWin);
    expect(r.homeWin + r.awayWin).toBeLessThanOrEqual(1.001);
  });

  test("marges +1..+10 décroissantes (favori)", () => {
    const r = scoreMatrixForMatch({ homeOdds: 1.5, drawOdds: 4.0, awayOdds: 6.0 });
    expect(r.margins.map((m) => m.diff)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.margins[0].prob).toBeGreaterThan(r.margins[9].prob);
  });

  test("cotes égales → matrice symétrique", () => {
    const r = scoreMatrixForMatch({ homeOdds: 2.8, drawOdds: 3.0, awayOdds: 2.8 });
    expect(Math.abs(r.matrix[2][0].prob - r.matrix[0][2].prob)).toBeLessThan(0.02);
  });

  test("sans cotes → lambdas par défaut finis", () => {
    const r = scoreMatrixForMatch({});
    expect(Number.isFinite(r.lambdaHome)).toBe(true);
    expect(Number.isFinite(r.lambdaAway)).toBe(true);
    const sum = r.matrix.flat().reduce((a, c) => a + c.prob, 0);
    expect(sum).toBeGreaterThan(0.99);
  });
});
