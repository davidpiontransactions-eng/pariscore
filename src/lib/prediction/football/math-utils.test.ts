import { describe, expect, test } from "bun:test";
import { clamp01, normalizeMatrix, round2 } from "./math-utils";

describe("math-utils", () => {
  test("round2 arrondit à 2 décimales", () => {
    expect(round2(0.12345)).toBe(0.12);
    expect(round2(0.125)).toBe(0.13);
  });
  test("clamp01 borne [0,1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  test("normalizeMatrix somme à 1", () => {
    const m = normalizeMatrix([[1, 2], [3, 4]]);
    const sum = m.flat().reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});