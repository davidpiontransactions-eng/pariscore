// Tests vitibet/over — pill « Over XX pts conseillé » (bead f1qc).
// Convention projet : import explicite depuis "bun:test".
import { describe, expect, test } from "bun:test";
import { bestOverLine, normalCdf, overProb, OVER_FLOOR } from "../vitibet/over";

describe("normalCdf", () => {
  test("valeurs de référence Φ", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 2);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 2);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
  });
});

describe("overProb", () => {
  test("P(total > ligne) décroît quand la ligne monte", () => {
    const pLow = overProb(62, 6, 55.5)!;
    const pHigh = overProb(62, 6, 59.5)!;
    expect(pLow).toBeGreaterThan(pHigh);
    expect(pLow).toBeGreaterThan(0.5);
    expect(pHigh).toBeGreaterThan(0.5);
  });

  test("invalides → null (σ ≤ 0, NaN)", () => {
    expect(overProb(62, 0, 55.5)).toBeNull();
    expect(overProb(62, -1, 55.5)).toBeNull();
    expect(overProb(NaN, 6, 55.5)).toBeNull();
  });
});

describe("bestOverLine", () => {
  test("retient la PLUS HAUTE ligne ≥ 65 % (total 62, σ 6 → 59.5)", () => {
    const pick = bestOverLine(62, 6);
    expect(pick).not.toBeNull();
    expect(pick!.line).toBe(59.5);
    expect(pick!.prob).toBeGreaterThanOrEqual(OVER_FLOOR);
    // ligne suivante (60.5) doit être sous le seuil
    expect(overProb(62, 6, 60.5)!).toBeLessThan(OVER_FLOOR);
  });

  test("σ très grand → aucune ligne ≥ 65 % → null (jamais de pill fabriquée)", () => {
    expect(bestOverLine(62, 100)).toBeNull();
  });

  test("sigma null (échantillon < 30) → null", () => {
    expect(bestOverLine(62, null)).toBeNull();
  });

  test("total élevé (70, σ 5) → ligne haute qualifiée", () => {
    const pick = bestOverLine(70, 5);
    expect(pick).not.toBeNull();
    expect(pick!.line).toBeGreaterThanOrEqual(63.5);
    expect(pick!.prob).toBeGreaterThanOrEqual(OVER_FLOOR);
  });
});
