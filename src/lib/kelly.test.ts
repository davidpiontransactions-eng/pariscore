import { describe, test, expect } from "bun:test";
import { computeKellyStake, KELLY_FRACTION_CAP } from "./kelly";

describe("computeKellyStake", () => {
  test("odds <= 1 → aucune mise", () => {
    expect(computeKellyStake(80, 1.0)).toEqual({ pct: 0, capped: false });
    expect(computeKellyStake(80, 0.5)).toEqual({ pct: 0, capped: false });
  });

  test("EV <= 0 (p * cote <= 1) → aucune mise", () => {
    // p = 0.55, cote = 1.8 → 0.55 * 1.8 = 0.99 < 1 → f* <= 0
    expect(computeKellyStake(55, 1.8)).toEqual({ pct: 0, capped: false });
    // p = 0.84, cote = 1.18 → 0.84 * 1.18 = 0.99 < 1 → f* <= 0
    expect(computeKellyStake(84, 1.18)).toEqual({ pct: 0, capped: false });
  });

  test("fractional Kelly cap à 0.25 (référence engine.py)", () => {
    // p = 0.5, cote = 3.0 → f* = (0.5*2 - 0.5)/2 = 0.25 → cap atteint
    const res = computeKellyStake(50, 3.0);
    expect(res.pct).toBe(KELLY_FRACTION_CAP * 100);
    expect(res.capped).toBe(true);
  });

  test("mise positive sous le cap", () => {
    // p = 0.6, cote = 2.0 → f* = (0.6*1 - 0.4)/1 = 0.20 → 20%
    const res = computeKellyStake(60, 2.0);
    expect(res.pct).toBeCloseTo(20, 5);
    expect(res.capped).toBe(false);
  });

  test("proba hors bornes clampée", () => {
    expect(computeKellyStake(-10, 2.0)).toEqual({ pct: 0, capped: false });
    expect(computeKellyStake(110, 2.0)).toEqual({ pct: KELLY_FRACTION_CAP * 100, capped: true });
  });
});
